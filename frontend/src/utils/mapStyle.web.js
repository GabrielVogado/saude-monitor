/**
 * Variante Web de `mapStyle.js`. O original importa `@rnmapbox/maps` só para o
 * enum `StyleURL.Street` e para chamar `setAccessToken` — a biblioteca não tem build
 * Web, então esta versão usa a URL de estilo equivalente do Mapbox diretamente; o
 * token de acesso é aplicado a `mapbox-gl` em `utils/mapkit/index.web.js`, que é
 * quem de fato desenha o mapa nesta plataforma.
 *
 * `getInitialViewState` é pura matemática (sem dependência do SDK) e fica idêntica à
 * versão nativa — ver o comentário lá para a fórmula do zoom.
 */
export const MAPBOX_STYLE = "mapbox://styles/mapbox/streets-v12";

export function getInitialViewState(region) {
  const { latitude, longitude, longitudeDelta = 0.02 } = region || {};
  const zoom = Math.max(0, Math.min(19, Math.round(Math.log2(360 / longitudeDelta))));
  return {
    centerCoordinate: [longitude, latitude],
    zoomLevel: zoom,
  };
}
