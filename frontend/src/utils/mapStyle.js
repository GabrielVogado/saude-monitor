/**
 * Configuração de mapa do MapLibre (MVP sem custo).
 *
 * O MapLibre React Native NÃO embute estilo de mapa por padrão. Este módulo
 * fornece um estilo raster apontando para os tiles do OpenStreetMap (gratuito e
 * sem token), além de um helper para converter regiões no formato legado
 * ({ latitude, longitude, latitudeDelta, longitudeDelta }) em estado de câmera.
 */

import { colors } from "../theme";

/**
 * Estilo raster do OpenStreetMap.
 *
 * Atribuição obrigatória: "© OpenStreetMap contributors".
 * Limite de uso: tile.openstreetmap.org é adequado para MVP/dev; para produção
 * com tráfego relevante, considere um provedor de tiles com SLA (decisão a tomar).
 */
export const OSM_RASTER_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,

      /**
       * BUG-06 — este 19 é o número certo; o que estava errado era o LUGAR.
       *
       * Ele morava na camada, e no style spec `maxzoom` de camada e `maxzoom` de fonte
       * são coisas opostas. Citando o `v8.json` do `@maplibre/maplibre-gl-style-spec`
       * instalado:
       *
       *   layer.maxzoom  — "At zoom levels equal to or greater than the maxzoom,
       *                     the layer will be hidden."
       *   source.maxzoom — "Maximum zoom level for which tiles are available (...).
       *                     Data from tiles at the maxzoom are used when displaying
       *                     the map at higher zoom levels."
       *
       * Ou seja: na camada, 19 mandava ESCONDER o mapa a partir de z19. Como este
       * estilo tem uma única camada de conteúdo, passar de z19 apagava o mapa inteiro
       * e sobrava o fundo — o "mapa escurece" relatado pelo PO, nas duas telas que
       * usam este estilo (aba Mapa e detalhe do hospital).
       *
       * Na fonte, o mesmo 19 diz a verdade sobre o servidor: o
       * `tile.openstreetmap.org` publica até z19. Acima disso o MapLibre REAMPLIA os
       * tiles de z19 em vez de pedir tiles que não existem. Sem esse número aqui, a
       * fonte assumia o padrão do spec — `maxzoom: 22` — e o app pedia z20, z21 e z22
       * a um servidor gratuito que responde 404 para todos.
       */
      maxzoom: 19,

      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      /**
       * O fundo é nosso, e não a cor de limpeza do renderizador.
       *
       * Sem uma camada de `background`, o que aparece atrás dos tiles é o que o
       * MapLibre pinta por conta própria — o preto-azulado da captura do BUG-06. Com o
       * `maxzoom` no lugar certo esse fundo deixa de tomar a tela, mas ele continua
       * visível enquanto os tiles carregam e se a rede falhar. Um cinza claro do Design
       * System se parece com "mapa carregando"; um vazio preto se parece com app
       * quebrado.
       */
      id: "fundo",
      type: "background",
      paint: { "background-color": colors.surfaceContainerLow },
    },
    {
      id: "osm",
      type: "raster",
      source: "osm",
      minzoom: 0,
    },
  ],
};

/**
 * Converte uma região legada (formato { latitude, longitude, latitudeDelta, longitudeDelta })
 * em `initialViewState` do MapLibre.
 *
 * O zoom é aproximado a partir do `longitudeDelta`:
 *   zoom ≈ log2(360 / longitudeDelta)
 * Ex.: longitudeDelta 0.02 → zoom 14 · 0.015 → 15 · 20 → 4 · 35 → 3.
 *
 * @param {{latitude:number, longitude:number, longitudeDelta?:number}} region
 * @returns {{ center: [number, number], zoom: number }}
 */
export function getInitialViewState(region) {
  const { latitude, longitude, longitudeDelta = 0.02 } = region || {};
  const zoom = Math.max(
    0,
    Math.min(19, Math.round(Math.log2(360 / longitudeDelta)))
  );
  return {
    center: [longitude, latitude],
    zoom,
  };
}
