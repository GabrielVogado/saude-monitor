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

/** Lados do polígono usado para aproximar o círculo — espelha `GeofenceFactory.LADOS_CIRCULO`. */
export const LADOS_CIRCULO = 32;

const METROS_POR_GRAU_LAT = 111320;

/**
 * Reconstrói o círculo do geofence a partir de centro e raio (E8-03).
 *
 * A listagem `GET /api/v1/hospitais` deixou de trafegar o polígono: ele respondia
 * por 73,6% do corpo da resposta e é dado derivado, já que o backend o gera com
 * `GeofenceFactory.criarCirculo`. Esta função é a contraparte cliente daquele
 * método — mesma aproximação equiretangular, mesma contagem de lados.
 */
export function circuloParaCoordenadas(centro, raioMetros, lados = LADOS_CIRCULO) {
  if (
    !centro ||
    !Number.isFinite(centro.latitude) ||
    !Number.isFinite(centro.longitude) ||
    !Number.isFinite(raioMetros) ||
    raioMetros <= 0
  ) {
    return [];
  }

  const deltaLat = raioMetros / METROS_POR_GRAU_LAT;
  const deltaLng =
    raioMetros / (METROS_POR_GRAU_LAT * Math.cos((centro.latitude * Math.PI) / 180));

  const vertices = [];
  for (let i = 0; i < lados; i += 1) {
    const angulo = (2 * Math.PI * i) / lados;
    vertices.push({
      latitude: centro.latitude + deltaLat * Math.cos(angulo),
      longitude: centro.longitude + deltaLng * Math.sin(angulo),
    });
  }
  vertices.push(vertices[0]);

  return vertices;
}

/**
 * Centro do geofence de um hospital, seja qual for o formato da resposta.
 *
 * Prefere `localizacao` (listagem, desde E8-03) e cai para o centroide do polígono
 * quando ele vem completo — caso do detalhe (`GET /hospitais/{id}`). Assim as telas
 * funcionam com as duas formas sem se importar com a origem do dado.
 */
export function centroDoHospital(hospital) {
  const loc = hospital?.localizacao;
  if (loc && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)) {
    return { latitude: loc.latitude, longitude: loc.longitude };
  }
  return calcularCentroide(geojsonParaCoordenadas(hospital?.geofence));
}

/** Vértices do geofence de um hospital, vindos do polígono ou reconstruídos do centro + raio. */
export function coordenadasDoHospital(hospital) {
  const doPoligono = geojsonParaCoordenadas(hospital?.geofence);
  if (doPoligono.length > 0) {
    return doPoligono;
  }
  return circuloParaCoordenadas(centroDoHospital(hospital), hospital?.raioMetros);
}

/**
 * Monta a FeatureCollection dos geofences dos hospitais para o MapLibre (F-07).
 *
 * Cada feature carrega `id` e `nome` nas propriedades, para que o toque no
 * polígono consiga identificar o hospital de origem. Hospitais sem geofence
 * válido são descartados — o mapa não deve quebrar por dado incompleto.
 *
 * Desde E8-03 a geometria vem de `coordenadasDoHospital`, que aceita tanto o
 * polígono completo quanto o par centro + raio devolvido pela listagem.
 */
export function geofencesParaFeatureCollection(hospitais) {
  const features = (hospitais || [])
    .map((hospital) => ({ hospital, vertices: coordenadasDoHospital(hospital) }))
    .filter(({ vertices }) => vertices.length > 0)
    .map(({ hospital, vertices }) => ({
      type: "Feature",
      id: hospital.id,
      properties: { id: hospital.id, nome: hospital.nome },
      geometry: coordenadasParaGeoJson(vertices),
    }));

  return { type: "FeatureCollection", features };
}
