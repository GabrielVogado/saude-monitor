/**
 * Configuração da API (Fase 0) — construção de URLs base por ambiente.
 */
import { buildApiUrl, getApiBaseUrl } from "../../config/api";

describe("config/api — buildApiUrl", () => {
  const ORIGINAL = process.env.EXPO_PUBLIC_API_BASE_URL;

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL;
    }
  });

  test("respeita EXPO_PUBLIC_API_BASE_URL e remove barra final", () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.exemplo.com/";
    expect(getApiBaseUrl()).toBe("https://api.exemplo.com");
  });

  test("buildApiUrl combina base e caminho", () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.exemplo.com";
    expect(buildApiUrl("/api/v1/hospitais")).toBe("https://api.exemplo.com/api/v1/hospitais");
    // aceita caminho sem barra inicial
    expect(buildApiUrl("api/v1/hospitais")).toBe("https://api.exemplo.com/api/v1/hospitais");
  });

  test("sempre devolve uma URL http(s) mesmo sem variável de ambiente", () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    const url = buildApiUrl("/api/v1/feedbacks");
    expect(url.startsWith("http://") || url.startsWith("https://")).toBe(true);
    expect(url.endsWith("/api/v1/feedbacks")).toBe(true);
  });
});
