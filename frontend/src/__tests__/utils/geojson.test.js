/**
 * Conversores GeoJSON (Épico 02 — detecção de visitas/geofence, F-03).
 * GeoJSON usa [longitude, latitude]; o mapa usa { latitude, longitude }.
 */
import { geojsonParaCoordenadas, coordenadasParaGeoJson, calcularCentroide } from "../../utils/geojson";

describe("utils/geojson — geojsonParaCoordenadas", () => {
  test("converte Polygon GeoJSON em vértices {latitude, longitude}", () => {
    const geofence = {
      type: "Polygon",
      coordinates: [[[-47.89, -15.79], [-47.88, -15.79], [-47.88, -15.78], [-47.89, -15.79]]],
    };
    expect(geojsonParaCoordenadas(geofence)).toEqual([
      { latitude: -15.79, longitude: -47.89 },
      { latitude: -15.79, longitude: -47.88 },
      { latitude: -15.78, longitude: -47.88 },
      { latitude: -15.79, longitude: -47.89 },
    ]);
  });

  test("retorna [] quando o geofence é vazio/inválido", () => {
    expect(geojsonParaCoordenadas(null)).toEqual([]);
    expect(geojsonParaCoordenadas({})).toEqual([]);
    expect(geojsonParaCoordenadas({ coordinates: [] })).toEqual([]);
  });
});

describe("utils/geojson — coordenadasParaGeoJson", () => {
  test("gera Polygon fechado a partir de vértices", () => {
    const vertices = [
      { latitude: -15.79, longitude: -47.89 },
      { latitude: -15.79, longitude: -47.88 },
      { latitude: -15.78, longitude: -47.88 },
    ];
    const geo = coordenadasParaGeoJson(vertices);
    expect(geo.type).toBe("Polygon");
    expect(geo.coordinates[0]).toEqual([
      [-47.89, -15.79],
      [-47.88, -15.79],
      [-47.88, -15.78],
      [-47.89, -15.79],
    ]);
  });

  test("não duplica o vértice de fechamento já informado", () => {
    const aberto = [
      { latitude: -15.79, longitude: -47.89 },
      { latitude: -15.79, longitude: -47.88 },
    ];
    const fechado = coordenadasParaGeoJson(aberto);
    // dois vértices distintos + 1 de fechamento
    expect(fechado.coordinates[0].length).toBe(3);
  });

  test("ignora vértices inválidos e retorna null se não houver nenhum", () => {
    expect(coordenadasParaGeoJson([{ latitude: "a", longitude: "b" }])).toBeNull();
    expect(coordenadasParaGeoJson([])).toBeNull();
    expect(coordenadasParaGeoJson(null)).toBeNull();
  });
});

describe("utils/geojson — calcularCentroide", () => {
  test("calcula a média de latitude/longitude", () => {
    const centroide = calcularCentroide([
      { latitude: 0, longitude: 0 },
      { latitude: 10, longitude: 10 },
    ]);
    expect(centroide.latitude).toBe(5);
    expect(centroide.longitude).toBe(5);
  });

  test("retorna null sem vértices válidos", () => {
    expect(calcularCentroide([])).toBeNull();
    expect(calcularCentroide(null)).toBeNull();
  });
});
