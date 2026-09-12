/**
 * Distância geográfica para rótulos (BUG-11 — desambiguação de unidades empilhadas).
 *
 * Quando 2+ unidades dividem o mesmo nome ("Ubs São Sebastião" ×5 no complexo da
 * Papuda), o nome sozinho não distingue os botões do seletor. A distância a partir
 * do GPS do usuário distingue ("Ubs São Sebastião · 120 m").
 */

/** Distância haversine em metros entre dois pontos { latitude, longitude }. */
export function haversineMetros(a, b) {
  if (!a || !b) {
    return null;
  }
  const { latitude: lat1, longitude: lon1 } = a;
  const { latitude: lat2, longitude: lon2 } = b;
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) {
    return null;
  }
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** "120 m" / "1,2 km" (vírgula decimal, pt-BR). */
export function formatarDistancia(metros) {
  if (!Number.isFinite(metros) || metros < 0) {
    return null;
  }
  if (metros < 1000) {
    return `${Math.round(metros)} m`;
  }
  return `${(metros / 1000).toFixed(1).replace(".", ",")} km`;
}
