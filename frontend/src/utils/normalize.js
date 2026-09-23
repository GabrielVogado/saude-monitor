/**
 * Utilidades de normalização de texto (Épico 01 — busca de hospitais).
 */

/**
 * Normaliza um texto para comparação/busca insensível a acentos e caixa:
 * decompõe em NFD, remove diacríticos (marcas combinantes) e converte para minúsculas.
 *
 * Ex.: "Policlínica" → "policlinica"; "HOSPITAL" → "hospital";
 *      "UBS 6 Paranoá" → "ubs 6 paranoa".
 *
 * @param {string | null | undefined} value texto a normalizar.
 * @returns {string} texto normalizado (vazio se `value` for nulo/indefinido).
 */
export function normalizeText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  // Hermes (React Native) e navegadores modernos suportam String.normalize.
  const decomposed =
    typeof str.normalize === "function" ? str.normalize("NFD") : str;

  return decomposed
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
