/**
 * Normalização de texto (Épico 01 — busca de hospitais insensível a acentos/caixa).
 * Fonte: Documento-Negocial §6 (busca por nome) e sessão de busca de hospitais.
 */
import { normalizeText } from "../../utils/normalize";

describe("utils/normalize — normalizeText", () => {
  test("remove acentos e converte para minúsculas", () => {
    expect(normalizeText("Policlínica")).toBe("policlinica");
    expect(normalizeText("HOSPITAL")).toBe("hospital");
    expect(normalizeText("UBS 6 Paranoá")).toBe("ubs 6 paranoa");
    expect(normalizeText("São Paulo")).toBe("sao paulo");
  });

  test("remove espaços das bordas", () => {
    expect(normalizeText("  Hospital  ")).toBe("hospital");
  });

  test("retorna string vazia para null/undefined", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
  });

  test("números são tratados como texto", () => {
    expect(normalizeText(123)).toBe("123");
  });
});
