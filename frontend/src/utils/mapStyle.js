/**
 * Estilo do mapa e conversão de região legada em posição de câmera.
 *
 * O mapa usa MapLibre (`@maplibre/maplibre-react-native` no aparelho, `maplibre-gl` na
 * Web) com o estilo vetorial Liberty do OpenFreeMap: gratuito, sem chave de acesso e
 * sem limite de acessos, mas sem SLA. A atribuição ao OpenStreetMap e ao OpenMapTiles
 * é obrigatória e fica ligada nos dois adaptadores de `utils/mapkit`.
 *
 * O estilo é só esta URL: trocar de provedor (por exemplo, um PMTiles próprio servido
 * pelo saudemonitor.dev, previsto no plano de escala) é mudar esta constante. Se o
 * provedor cair, o mapa fica sem fundo; marcadores, geofences e lista continuam.
 *
 * Os geofences continuam GeoJSON de `utils/geojson.js`, agnóstico ao SDK.
 */
export const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

/**
 * Converte uma região legada (formato { latitude, longitude, latitudeDelta, longitudeDelta })
 * em posição inicial para a `Camera` de `utils/mapkit`.
 *
 * O zoom é aproximado a partir do `longitudeDelta`:
 *   zoom ≈ log2(360 / longitudeDelta)
 * Ex.: longitudeDelta 0.02 → zoom 14 · 20 → 4 · 35 → 3.
 *
 * @param {{latitude:number, longitude:number, longitudeDelta?:number}} region
 * @returns {{ centerCoordinate: [number, number], zoomLevel: number }}
 */
export function getInitialViewState(region) {
  const { latitude, longitude, longitudeDelta = 0.02 } = region || {};
  const zoom = Math.max(0, Math.min(19, Math.round(Math.log2(360 / longitudeDelta))));
  return {
    centerCoordinate: [longitude, latitude],
    zoomLevel: zoom,
  };
}
