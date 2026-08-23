/**
 * Formatadores e validadores compartilhados (Épico 01 — Hospitais).
 */

/** Formata minutos como "2h05" (acima de 1h) ou "45min". */
export function formatarDuracao(minutos) {
  if (minutos === null || minutos === undefined || Number.isNaN(Number(minutos))) {
    return null;
  }

  const total = Math.max(0, Math.round(Number(minutos)));
  const horas = Math.floor(total / 60);
  const resto = total % 60;

  if (horas === 0) {
    return `${resto}min`;
  }

  return `${horas}h${String(resto).padStart(2, "0")}`;
}

/** Formata nota com uma casa decimal (ex.: 4.2). */
export function formatarNota(nota) {
  if (nota === null || nota === undefined || Number.isNaN(Number(nota))) {
    return null;
  }

  return Number(nota).toFixed(1).replace(".", ",");
}

/** Valida CNPJ no formato XX.XXX.XXX/XXXX-XX. */
export function cnpjValido(cnpj) {
  return /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(cnpj || "");
}

/** Valida telefone nos formatos (XX) XXXXX-XXXX ou (XX) XXXX-XXXX. */
export function telefoneValido(telefone) {
  return /^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(telefone || "");
}

/** Valida e-mail simples. */
export function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim());
}

/** Máscara simples de CNPJ conforme o usuário digita. */
export function mascararCnpj(valor) {
  const digits = (valor || "").replace(/\D/g, "").slice(0, 14);
  const p = (a, b) => (digits.length > a ? digits.slice(a, b) : "");

  let out = p(0, 2);
  if (digits.length > 2) out += `.${p(2, 5)}`;
  if (digits.length > 5) out += `.${p(5, 8)}`;
  if (digits.length > 8) out += `/${p(8, 12)}`;
  if (digits.length > 12) out += `-${p(12, 14)}`;

  return out;
}

/** Máscara simples de CEP XXXXX-XXX. */
export function mascararCep(valor) {
  const digits = (valor || "").replace(/\D/g, "").slice(0, 8);

  if (digits.length > 5) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  return digits;
}
