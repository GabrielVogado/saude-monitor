/**
 * Estilo do mapa (MapLibre) e conversão de região legada em estado de câmera.
 *
 * O módulo não tinha teste nenhum até o BUG-06 — e foi exatamente ali que o defeito
 * morou por semanas, num único número no lugar errado.
 */
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { getInitialViewState, OSM_RASTER_STYLE } from "../../utils/mapStyle";

const camadaRaster = () => OSM_RASTER_STYLE.layers.find((c) => c.type === "raster");

describe("OSM_RASTER_STYLE", () => {
  test("é um estilo válido para o style spec", () => {
    // Não é este teste que protege do BUG-06 — `maxzoom` numa camada é sintaxe
    // perfeitamente válida, e o validador aprova as duas versões. Ele existe para o
    // resto: nome de propriedade errado, tipo de camada inexistente, fonte sem `tiles`.
    expect(validateStyleMin(OSM_RASTER_STYLE)).toEqual([]);
  });

  test("BUG-06: o teto de zoom fica na FONTE, para reampliar os tiles de z19", () => {
    // `source.maxzoom` no spec: "Data from tiles at the maxzoom are used when
    // displaying the map at higher zoom levels." É o que faz o mapa continuar
    // existindo depois de z19, ampliado, em vez de sumir.
    //
    // Sem este número, a fonte assume o padrão do spec (22) e o app passa a pedir
    // z20, z21 e z22 ao tile.openstreetmap.org, que publica só até z19 e devolve 404.
    expect(OSM_RASTER_STYLE.sources.osm.maxzoom).toBe(19);
  });

  test("BUG-06: nenhuma camada de conteúdo se esconde por `maxzoom`", () => {
    // `layer.maxzoom` no spec é o OPOSTO: "At zoom levels equal to or greater than
    // the maxzoom, the layer will be hidden." Como este estilo tem uma única camada
    // de conteúdo, um `maxzoom` nela apagava o mapa inteiro a partir daquele zoom —
    // o "mapa escurece" relatado pelo PO.
    //
    // A asserção é sobre TODAS as camadas de conteúdo, e não só sobre a raster de
    // hoje: o defeito é a propriedade estar na camada, não a camada ser esta.
    const comTeto = OSM_RASTER_STYLE.layers.filter(
      (c) => c.type !== "background" && c.maxzoom !== undefined
    );
    expect(comTeto).toEqual([]);
  });

  test("BUG-06: há um fundo próprio, e ele fica ATRÁS do mapa", () => {
    // Sem camada de `background`, o que aparece enquanto os tiles carregam (ou quando
    // a rede falha) é a cor de limpeza do renderizador — o preto da captura. A ordem
    // importa: no MapLibre as camadas desenham na ordem do array, então um fundo
    // depois da raster cobriria o mapa em vez de ficar atrás dele.
    const fundo = OSM_RASTER_STYLE.layers.findIndex((c) => c.type === "background");
    const raster = OSM_RASTER_STYLE.layers.findIndex((c) => c.type === "raster");

    expect(fundo).toBeGreaterThanOrEqual(0);
    expect(fundo).toBeLessThan(raster);
    expect(OSM_RASTER_STYLE.layers[fundo].paint["background-color"]).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test("a camada raster desenha desde o zoom 0 e aponta para a fonte osm", () => {
    expect(camadaRaster()).toMatchObject({ source: "osm", minzoom: 0 });
    expect(OSM_RASTER_STYLE.sources.osm.tiles).toEqual([
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    ]);
  });

  test("mantém a atribuição obrigatória do OpenStreetMap", () => {
    // Não é enfeite: usar os tiles sem creditar viola os termos de uso do OSM.
    expect(OSM_RASTER_STYLE.sources.osm.attribution).toBe("© OpenStreetMap contributors");
  });
});

describe("getInitialViewState", () => {
  test("converte o longitudeDelta em zoom por log2(360 / delta)", () => {
    expect(getInitialViewState({ latitude: -15.8, longitude: -47.9, longitudeDelta: 0.02 })).toEqual(
      { center: [-47.9, -15.8], zoom: 14 }
    );
    expect(getInitialViewState({ latitude: 0, longitude: 0, longitudeDelta: 35 })).toEqual({
      center: [0, 0],
      zoom: 3,
    });
  });

  test("sem longitudeDelta, assume 0.02 — o enquadramento de um hospital", () => {
    expect(getInitialViewState({ latitude: -15.8, longitude: -47.9 }).zoom).toBe(14);
  });

  test("nunca devolve zoom fora de [0, 19]", () => {
    // O teto de 19 aqui é o mesmo teto de tiles da fonte: enquadrar num zoom sem
    // tile disponível abriria a tela já reampliada, sem ninguém ter dado zoom.
    expect(getInitialViewState({ latitude: 0, longitude: 0, longitudeDelta: 0.0000001 }).zoom).toBe(19);
    expect(getInitialViewState({ latitude: 0, longitude: 0, longitudeDelta: 100000 }).zoom).toBe(0);
  });

  test("sem região, não quebra — devolve coordenadas indefinidas no zoom padrão", () => {
    // A tela chama isto com o que tiver; um `undefined` aqui não pode derrubar o mapa.
    expect(getInitialViewState()).toEqual({ center: [undefined, undefined], zoom: 14 });
  });
});
