import { formatarDistancia, haversineMetros } from "../../utils/distancia";

describe("haversineMetros", () => {
  test("pontos idênticos têm distância zero", () => {
    expect(haversineMetros({ latitude: -15.8, longitude: -47.9 }, { latitude: -15.8, longitude: -47.9 })).toBe(0);
  });

  test("~110 m em latitude (0.001° ≈ 111 m)", () => {
    expect(haversineMetros({ latitude: -15.8, longitude: -47.9 }, { latitude: -15.799, longitude: -47.9 })).toBeCloseTo(111, 0);
  });

  test("coordenada inválida não derruba — devolve null", () => {
    expect(haversineMetros(null, { latitude: 0, longitude: 0 })).toBeNull();
    expect(haversineMetros({ latitude: NaN, longitude: 0 }, { latitude: 0, longitude: 0 })).toBeNull();
  });
});

describe("formatarDistancia", () => {
  test("metros abaixo de 1 km", () => {
    expect(formatarDistancia(120)).toBe("120 m");
    expect(formatarDistancia(44.6)).toBe("45 m");
  });

  test("quilômetros com vírgula decimal", () => {
    expect(formatarDistancia(1200)).toBe("1,2 km");
  });

  test("valor inválido devolve null", () => {
    expect(formatarDistancia(NaN)).toBeNull();
    expect(formatarDistancia(-1)).toBeNull();
  });
});
