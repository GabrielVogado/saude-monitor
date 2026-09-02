/**
 * Conversores GeoJSON (Épico 02 — detecção de visitas/geofence, F-03).
 * GeoJSON usa [longitude, latitude]; o mapa usa { latitude, longitude }.
 */
import {
  geojsonParaCoordenadas,
  coordenadasParaGeoJson,
  calcularCentroide,
  circuloParaCoordenadas,
  centroDoHospital,
  LADOS_CIRCULO,
  geofencesParaFeatureCollection,
} from "../../utils/geojson";

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

describe("utils/geojson — geofencesParaFeatureCollection (F-07)", () => {
  const ANEL = [[-47.89, -15.79], [-47.88, -15.79], [-47.88, -15.78], [-47.89, -15.79]];

  test("monta FeatureCollection com id e nome nas propriedades", () => {
    const fc = geofencesParaFeatureCollection([
      { id: "h1", nome: "Hospital Alfa", geofence: { type: "Polygon", coordinates: [ANEL] } },
    ]);

    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]).toMatchObject({
      type: "Feature",
      id: "h1",
      properties: { id: "h1", nome: "Hospital Alfa" },
      geometry: { type: "Polygon", coordinates: [ANEL] },
    });
  });

  test("descarta hospitais sem geofence válido em vez de quebrar o mapa", () => {
    const fc = geofencesParaFeatureCollection([
      { id: "h1", nome: "Sem geofence" },
      { id: "h2", nome: "Geofence vazia", geofence: { type: "Polygon", coordinates: [] } },
      { id: "h3", nome: "Válido", geofence: { type: "Polygon", coordinates: [ANEL] } },
    ]);

    expect(fc.features.map((f) => f.id)).toEqual(["h3"]);
  });

  test("lista vazia ou nula devolve FeatureCollection vazia", () => {
    expect(geofencesParaFeatureCollection([]).features).toEqual([]);
    expect(geofencesParaFeatureCollection(null).features).toEqual([]);
  });
});

// E8-03: a listagem passou a devolver `localizacao` + `raioMetros` no lugar do polígono.
describe("E8-03 — geofence reconstruído a partir de centro e raio", () => {
  const hospitalDaListagem = {
    id: "h1",
    nome: "Hospital A",
    localizacao: { latitude: -15.78, longitude: -47.88 },
    raioMetros: 150,
  };

  it("reconstrói o círculo com o mesmo número de lados do backend", () => {
    const vertices = circuloParaCoordenadas(
      hospitalDaListagem.localizacao,
      hospitalDaListagem.raioMetros
    );
    expect(vertices).toHaveLength(LADOS_CIRCULO + 1);
    expect(vertices[0]).toEqual(vertices[vertices.length - 1]);
  });

  it("mantém o centroide reconstruído próximo do centro informado", () => {
    const centro = centroDoHospital(hospitalDaListagem);
    expect(centro.latitude).toBeCloseTo(-15.78, 6);
    expect(centro.longitude).toBeCloseTo(-47.88, 6);
  });

  it("prefere `localizacao` mas ainda aceita o polígono completo do detalhe", () => {
    const doDetalhe = {
      geofence: {
        type: "Polygon",
        coordinates: [[[-47.88, -15.78], [-47.87, -15.78], [-47.87, -15.77], [-47.88, -15.78]]],
      },
    };
    expect(centroDoHospital(doDetalhe)).not.toBeNull();
    expect(centroDoHospital({})).toBeNull();
  });

  it("monta a FeatureCollection do mapa a partir do formato da listagem", () => {
    const fc = geofencesParaFeatureCollection([hospitalDaListagem]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry.type).toBe("Polygon");
    expect(fc.features[0].properties.id).toBe("h1");
    expect(fc.features[0].geometry.coordinates[0].length).toBe(LADOS_CIRCULO + 1);
  });

  it("descarta hospital sem centro nem polígono", () => {
    expect(geofencesParaFeatureCollection([{ id: "x" }]).features).toHaveLength(0);
    expect(circuloParaCoordenadas(null, 150)).toEqual([]);
    expect(circuloParaCoordenadas({ latitude: -15.78, longitude: -47.88 }, 0)).toEqual([]);
  });
});
