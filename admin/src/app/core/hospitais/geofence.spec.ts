import {
  LADOS_CIRCULO_ADMIN,
  centroide,
  criarCirculo,
  ehCirculoDoProduto,
  raioAproximadoMetros,
} from './geofence';
import { GeoJsonPolygon } from './hospital.models';

const CENTRO = { latitude: -15.79, longitude: -47.88 };

describe('geofence', () => {
  it('criarCirculo gera anel fechado com 48 lados (≠ 32, preservado pela reconciliação do backend)', () => {
    const g = criarCirculo(CENTRO, 120);
    const anel = g.coordinates[0];

    expect(LADOS_CIRCULO_ADMIN).not.toBe(32);
    expect(g.type).toBe('Polygon');
    expect(anel).toHaveLength(LADOS_CIRCULO_ADMIN + 1);
    expect(anel[anel.length - 1]).toEqual(anel[0]);
  });

  it('centroide e raio fazem a volta completa de um círculo gerado', () => {
    const g = criarCirculo(CENTRO, 150);
    const c = centroide(g)!;

    expect(c.latitude).toBeCloseTo(CENTRO.latitude, 6);
    expect(c.longitude).toBeCloseTo(CENTRO.longitude, 6);
    expect(raioAproximadoMetros(g, c)).toBe(150);
  });

  it('usa a ordem GeoJSON [lng, lat] nas posições', () => {
    const [lng, lat] = criarCirculo(CENTRO, 100).coordinates[0][0];
    // ângulo 0 → deslocamento só em latitude (para o norte)
    expect(lng).toBeCloseTo(CENTRO.longitude, 9);
    expect(lat).toBeGreaterThan(CENTRO.latitude);
  });

  it('centroide de polígono degenerado cai na média dos vértices; vazio devolve null', () => {
    const colinear: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 1], [2, 2], [0, 0]]],
    };
    expect(centroide(colinear)).toEqual({ longitude: 1, latitude: 1 });
    expect(centroide({ type: 'Polygon', coordinates: [[]] })).toBeNull();
    expect(raioAproximadoMetros({ type: 'Polygon', coordinates: [[]] }, CENTRO)).toBeNull();
  });

  it('ehCirculoDoProduto reconhece só o círculo de 32 lados do backend', () => {
    const produto = criarCirculo(CENTRO, 150, 32);
    const doPainel = criarCirculo(CENTRO, 150);

    expect(ehCirculoDoProduto(produto, centroide(produto)!)).toBe(true);
    expect(ehCirculoDoProduto(doPainel, centroide(doPainel)!)).toBe(false);

    // 32 vértices, mas um deles puxado para fora: deixa de ser regular
    const torto = criarCirculo(CENTRO, 150, 32);
    torto.coordinates[0][5] = [torto.coordinates[0][5][0] + 0.001, torto.coordinates[0][5][1]];
    expect(ehCirculoDoProduto(torto, centroide(torto)!)).toBe(false);
  });

  it('raio de um polígono irregular é a maior distância ao centro', () => {
    const c = { latitude: 0, longitude: 0 };
    const g: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [[[0, 0.001], [0.002, 0], [0, -0.001], [-0.001, 0], [0, 0.001]]],
    };
    // 0.002° de longitude no equador ≈ 222,64 m
    expect(raioAproximadoMetros(g, c)).toBe(223);
  });
});
