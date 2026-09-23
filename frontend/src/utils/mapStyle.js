/**
 * Configuração de mapa do Mapbox (`@rnmapbox/maps` v10).
 *
 * Migração MapLibre → Mapbox (branch `feature/mapbox-migration`): o estilo raster
 * próprio do OpenStreetMap (`OSM_RASTER_STYLE`, removido) foi trocado pelo estilo
 * vetorial `Street` servido pela conta Mapbox. Exige token público (`pk.*`) em
 * `EXPO_PUBLIC_MAPBOX_TOKEN` — arquivo `.env` local (nunca commitado) e secret do
 * EAS/CI para builds. Sem token o mapa monta vazio; as telas continuam funcionando
 * (lista, câmera e geofences apenas não renderizam tiles).
 *
 * Os geofences dos hospitais continuam GeoJSON produzido em `utils/geojson.js`
 * (círculos reconstruídos de centro + raio desde E8-03) — o formato é agnóstico
 * ao SDK e é entregue ao `ShapeSource` do Mapbox sem conversão. Os shapefiles de
 * pontos em `backend/data/` alimentam o seed do backend e não são tocados por
 * esta migração; as 4 camadas poligonais administrativas
 * (`multiplas_camadas_saude_14`) pertencem à F-11, adiada (D-01).
 */

import Mapbox from "@rnmapbox/maps";

// Token público gerado no painel da Mapbox (https://account.mapbox.com).
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "");

export const MAPBOX_STYLE = Mapbox.StyleURL.Street;

/**
 * Converte uma região legada (formato { latitude, longitude, latitudeDelta, longitudeDelta })
 * em posição inicial para a `Camera` do Mapbox.
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
  const zoom = Math.max(
    0,
    Math.min(19, Math.round(Math.log2(360 / longitudeDelta)))
  );
  return {
    centerCoordinate: [longitude, latitude],
    zoomLevel: zoom,
  };
}
