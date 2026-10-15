import { GeoJsonPolygon } from './hospital.models';

/**
 * Geometria do geofence no painel (E7-06) — espelha, em TypeScript, as contas que o
 * backend já faz em `GeofenceFactory` (centroide, raio aproximado e círculo), com a
 * mesma aproximação equiretangular. O backend continua sendo quem valida o polígono
 * (`GeofenceValidator`); estas funções só servem para o formulário mostrar o raio
 * atual e gerar o polígono novo quando o administrador muda o raio.
 */

const METROS_POR_GRAU_LAT = 111_320.0;
const EPS = 1e-12;

/**
 * Lados do círculo gerado pelo painel. **Precisa ser diferente de 32**
 * (`GeofenceFactory.LADOS_CIRCULO`): o `ReconciliacaoRaioGeofenceRunner` regrava, a cada
 * startup do backend, todo círculo regular de 32 lados cujo raio difere do raio da
 * categoria. Um raio escolhido aqui com 32 lados seria desfeito no próximo cold start;
 * com 48 lados ele é tratado como polígono próprio do administrador e preservado.
 */
export const LADOS_CIRCULO_ADMIN = 48;

/** `GeofenceFactory.LADOS_CIRCULO` — lados do círculo gerado pelo seed/importador. */
const LADOS_CIRCULO_PRODUTO = 32;
/** `GeofenceFactory.TOLERANCIA_CIRCULO_REGULAR`. */
const TOLERANCIA_CIRCULO_REGULAR = 0.02;

export interface Ponto {
  latitude: number;
  longitude: number;
}

/** Vértices do anel externo sem o ponto de fechamento repetido. */
function vertices(geofence: GeoJsonPolygon): number[][] {
  const anel = geofence.coordinates?.[0] ?? [];
  if (anel.length > 1) {
    const [p, u] = [anel[0], anel[anel.length - 1]];
    if (p[0] === u[0] && p[1] === u[1]) {
      return anel.slice(0, -1);
    }
  }
  return anel;
}

/** Centroide pelo método do cadarço; em polígono degenerado, média dos vértices. */
export function centroide(geofence: GeoJsonPolygon): Ponto | null {
  const vs = vertices(geofence);
  const m = vs.length;
  if (m === 0) {
    return null;
  }
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < m; i++) {
    const [ax, ay] = vs[i];
    const [bx, by] = vs[(i + 1) % m];
    const cross = ax * by - bx * ay;
    area += cross;
    cx += (ax + bx) * cross;
    cy += (ay + by) * cross;
  }
  area /= 2;
  if (Math.abs(area) > EPS) {
    return { longitude: cx / (6 * area), latitude: cy / (6 * area) };
  }
  const sx = vs.reduce((s, v) => s + v[0], 0);
  const sy = vs.reduce((s, v) => s + v[1], 0);
  return { longitude: sx / m, latitude: sy / m };
}

/** Maior distância, em metros, entre o centro e os vértices (arredondada). */
export function raioAproximadoMetros(geofence: GeoJsonPolygon, centro: Ponto): number | null {
  const vs = vertices(geofence);
  if (vs.length === 0) {
    return null;
  }
  const cosLat = Math.cos((centro.latitude * Math.PI) / 180);
  let maior = 0;
  for (const [lng, lat] of vs) {
    const dLat = (lat - centro.latitude) * METROS_POR_GRAU_LAT;
    const dLng = (lng - centro.longitude) * METROS_POR_GRAU_LAT * cosLat;
    maior = Math.max(maior, Math.hypot(dLat, dLng));
  }
  return maior < EPS ? null : Math.round(maior);
}

/**
 * Espelha `GeofenceFactory.ehCirculoRegular`: 32 lados com todos os vértices à mesma
 * distância do centro (2% de tolerância). É o círculo que o backend gerou — e o único que
 * a reconciliação de startup regrava para o raio padrão da categoria.
 */
export function ehCirculoDoProduto(geofence: GeoJsonPolygon, centro: Ponto): boolean {
  const vs = vertices(geofence);
  if (vs.length !== LADOS_CIRCULO_PRODUTO) {
    return false;
  }
  const cosLat = Math.cos((centro.latitude * Math.PI) / 180);
  const raios = vs.map(([lng, lat]) =>
    Math.hypot((lat - centro.latitude) * METROS_POR_GRAU_LAT, (lng - centro.longitude) * METROS_POR_GRAU_LAT * cosLat),
  );
  const maior = Math.max(...raios);
  return maior > EPS && (maior - Math.min(...raios)) / maior <= TOLERANCIA_CIRCULO_REGULAR;
}

/** Polígono regular fechado (GeoJSON, `[lng, lat]`) aproximando um círculo de `raioMetros`. */
export function criarCirculo(centro: Ponto, raioMetros: number, lados = LADOS_CIRCULO_ADMIN): GeoJsonPolygon {
  const deltaLat = raioMetros / METROS_POR_GRAU_LAT;
  const deltaLng = raioMetros / (METROS_POR_GRAU_LAT * Math.cos((centro.latitude * Math.PI) / 180));
  const anel: number[][] = [];
  for (let i = 0; i < lados; i++) {
    const angulo = (2 * Math.PI * i) / lados;
    anel.push([centro.longitude + deltaLng * Math.sin(angulo), centro.latitude + deltaLat * Math.cos(angulo)]);
  }
  anel.push([...anel[0]]);
  return { type: 'Polygon', coordinates: [anel] };
}
