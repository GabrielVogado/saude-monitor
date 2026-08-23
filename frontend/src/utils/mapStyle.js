/**
 * Configuração de mapa do MapLibre (MVP sem custo).
 *
 * O MapLibre React Native NÃO embute estilo de mapa por padrão. Este módulo
 * fornece um estilo raster apontando para os tiles do OpenStreetMap (gratuito e
 * sem token), além de um helper para converter regiões no formato legado
 * ({ latitude, longitude, latitudeDelta, longitudeDelta }) em estado de câmera.
 */

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
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      minzoom: 0,
      maxzoom: 19,
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
