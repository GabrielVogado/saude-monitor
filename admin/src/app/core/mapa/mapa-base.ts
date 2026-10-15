import * as L from 'leaflet';

/** O `tile.openstreetmap.org` só publica até z19 (ver BUG-06, ADR-014) — pedir mais 404. */
export const ZOOM_MAXIMO = 19;

/**
 * Mapa Leaflet com os tiles raster OSM do painel (ADR-014) e o ajuste de tamanho que o
 * layout exige: o Leaflet mede o container no momento do `L.map()` e, dentro de blocos
 * com animação (`fadeInUp`) ou flex, o tamanho final só se estabiliza depois do primeiro
 * paint — sem recalcular, o grid de tiles fica cortado. O `ResizeObserver` cobre isso e
 * qualquer mudança futura (ex.: sidebar recolhendo).
 *
 * Devolve o mapa e a função de limpeza (desconecta o observer e remove o mapa).
 */
export function criarMapaBase(el: HTMLElement): { mapa: L.Map; destruir: () => void } {
  const mapa = L.map(el);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: ZOOM_MAXIMO,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(mapa);

  // jsdom (ambiente de teste) não implementa ResizeObserver — degrada sem quebrar.
  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => mapa.invalidateSize());
    observer.observe(el);
  }

  return {
    mapa,
    destruir: () => {
      observer?.disconnect();
      mapa.remove();
    },
  };
}
