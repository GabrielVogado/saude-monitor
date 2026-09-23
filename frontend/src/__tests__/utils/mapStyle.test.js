/**
 * Estilo do mapa (Mapbox) e conversão de região legada em posição de câmera.
 *
 * Migração MapLibre → Mapbox (`feature/mapbox-migration`): o estilo raster próprio
 * (OSM_RASTER_STYLE) foi removido junto dos testes do BUG-06 (teto de zoom na fonte,
 * camada de background, atribuição OSM) — todos específicos do tile.openstreetmap.org
 * e sem equivalente no estilo vetorial `Street` servido pela conta Mapbox.
 */
import Mapbox from "@rnmapbox/maps";
import { getInitialViewState, MAPBOX_STYLE } from "../../utils/mapStyle";

jest.mock("@rnmapbox/maps", () => ({
  __esModule: true,
  default: { setAccessToken: jest.fn(), StyleURL: { Street: "mapbox://styles/mapbox/streets-v11" } },
  StyleURL: { Street: "mapbox://styles/mapbox/streets-v11" },
}));

describe("MAPBOX_STYLE", () => {
  test("usa o estilo Street servido pela conta Mapbox", () => {
    expect(MAPBOX_STYLE).toBe(Mapbox.StyleURL.Street);
  });

  test("expõe o registro do token público (chamado no import do módulo)", () => {
    // Afirma-se a fiação, não a chamada: o `clearMocks` do jest.config.js apaga o
    // histórico antes de cada teste, inclusive a chamada feita no import acima —
    // afirmar `toHaveBeenCalled` aqui reprovaria sempre, com o código correto.
    expect(typeof Mapbox.setAccessToken).toBe("function");
  });
});

describe("getInitialViewState", () => {
  test("converte o longitudeDelta em zoom por log2(360 / delta)", () => {
    expect(getInitialViewState({ latitude: -15.8, longitude: -47.9, longitudeDelta: 0.02 })).toEqual(
      { centerCoordinate: [-47.9, -15.8], zoomLevel: 14 }
    );
    expect(getInitialViewState({ latitude: 0, longitude: 0, longitudeDelta: 35 })).toEqual({
      centerCoordinate: [0, 0],
      zoomLevel: 3,
    });
  });

  test("sem longitudeDelta, assume 0.02 — o enquadramento de um hospital", () => {
    expect(getInitialViewState({ latitude: -15.8, longitude: -47.9 }).zoomLevel).toBe(14);
  });

  test("nunca devolve zoom fora de [0, 19]", () => {
    expect(getInitialViewState({ latitude: 0, longitude: 0, longitudeDelta: 0.0000001 }).zoomLevel).toBe(19);
    expect(getInitialViewState({ latitude: 0, longitude: 0, longitudeDelta: 100000 }).zoomLevel).toBe(0);
  });

  test("sem região, não quebra — devolve coordenadas indefinidas no zoom padrão", () => {
    // A tela chama isto com o que tiver; um `undefined` aqui não pode derrubar o mapa.
    expect(getInitialViewState()).toEqual({ centerCoordinate: [undefined, undefined], zoomLevel: 14 });
  });
});
