/**
 * Reexporta os componentes do Mapbox nativo (`@rnmapbox/maps`) usados pelas telas de
 * mapa. Existe para que essas telas importem de um único lugar (`utils/mapkit`) cuja
 * variante `.web.js` troca a implementação nativa por `mapbox-gl` na Web — sem isso,
 * `@rnmapbox/maps` não tem build Web e os componentes chegam `undefined` no navegador
 * (`Element type is invalid`, GeoLocalizacaoScreen/HospitalDetalheScreen).
 */
export { Camera, FillLayer, LineLayer, MapView, MarkerView, ShapeSource } from "@rnmapbox/maps";
