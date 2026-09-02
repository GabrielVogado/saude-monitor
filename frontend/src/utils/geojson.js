/**
 * Conversores GeoJSON <-> vértices de mapa.
 *
 * GeoJSON (RFC 7946) usa coordenadas [longitude, latitude].
 * As telas usam vértices no formato { latitude, longitude }.
 */

/** Converte um Polygon GeoJSON para uma lista de vértices { latitude, longitude }. */
export function geojsonParaCoordenadas(geofence) {
  const ring = geofence?.coordinates?.[0];

  if (!Array.isArray(ring) || ring.length === 0) {
    return [];
  }

  return ring.map(([longitude, latitude]) => ({ latitude, longitude }));
}

/**
 * Converte vértices do mapa para um Polygon GeoJSON (anel fechado).
 * Ignora o vértice de fechamento duplicado informado pelo chamador;
 * garante que o primeiro e o último sejam iguais.
 */
export function coordenadasParaGeoJson(vertices) {
  const pts = (vertices || []).filter(
    (p) => p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
  );

  if (pts.length === 0) {
    return null;
  }

  const anel = pts.map((p) => [p.longitude, p.latitude]);
  const primeiro = anel[0];
  const ultimo = anel[anel.length - 1];

  // Fecha o anel apenas se já não estiver fechado.
  if (primeiro[0] !== ultimo[0] || primeiro[1] !== ultimo[1]) {
    anel.push([primeiro[0], primeiro[1]]);
  }

  return {
    type: "Polygon",
    coordinates: [anel],
  };
}

/** Calcula o centroide (média simples) de uma lista de vértices do mapa. */
export function calcularCentroide(vertices) {
  const pts = (vertices || []).filter(
    (p) => p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
  );

  if (pts.length === 0) {
    return null;
  }

  const soma = pts.reduce(
    (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
    { latitude: 0, longitude: 0 }
  );

  return {
    latitude: soma.latitude / pts.length,
    longitude: soma.longitude / pts.length,
  };
}

/**
 * Monta a FeatureCollection dos geofences dos hospitais para o MapLibre (F-07).
 *
 * Cada feature carrega `id` e `nome` nas propriedades, para que o toque no
 * polígono consiga identificar o hospital de origem. Hospitais sem geofence
 * válido são descartados — o mapa não deve quebrar por dado incompleto.
 */
export function geofencesParaFeatureCollection(hospitais) {
  const features = (hospitais || [])
    .filter((hospital) => Array.isArray(hospital?.geofence?.coordinates?.[0]))
    .map((hospital) => ({
      type: "Feature",
      id: hospital.id,
      properties: { id: hospital.id, nome: hospital.nome },
      geometry: {
        type: "Polygon",
        coordinates: hospital.geofence.coordinates,
      },
    }));

  return { type: "FeatureCollection", features };
}
