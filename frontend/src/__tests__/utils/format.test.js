/**
 * Utilitários compartilhados (Fase 0/Épico 01) — formatadores e validadores.
 * Fontes: Documentos/01-negocio, Documentos/04-desenvolvimento; Padrao-UI-UX §2 (categorias) .
 */
import {
  formatarDuracao,
  formatarNota,
  cnpjValido,
  telefoneValido,
  emailValido,
  mascararCnpj,
  mascararCep,
} from "../../utils/format";

describe("utils/format — formatarDuracao", () => {
  test("formata de 0 a 59min como 'Nmin'", () => {
    expect(formatarDuracao(0)).toBe("0min");
    expect(formatarDuracao(45)).toBe("45min");
  });

  test("formata 1h+ como 'XhYY'", () => {
    expect(formatarDuracao(60)).toBe("1h00");
    expect(formatarDuracao(125)).toBe("2h05");
    expect(formatarDuracao(90)).toBe("1h30");
  });

  test("retorna null para valores inválidos", () => {
    expect(formatarDuracao(null)).toBeNull();
    expect(formatarDuracao(undefined)).toBeNull();
    expect(formatarDuracao("abc")).toBeNull();
    expect(formatarDuracao(NaN)).toBeNull();
  });

  test("trata durações negativas como zero", () => {
    expect(formatarDuracao(-10)).toBe("0min");
  });
});

describe("utils/format — formatarNota", () => {
  test("usa vírgula como separador decimal", () => {
    expect(formatarNota(4)).toBe("4,0");
    expect(formatarNota(4.2)).toBe("4,2");
  });

  test("retorna null para inválidos", () => {
    expect(formatarNota(null)).toBeNull();
    expect(formatarNota("x")).toBeNull();
  });
});

describe("utils/format — validadores (Épico 01)", () => {
  test("CNPJ válido apenas no formato XX.XXX.XXX/XXXX-XX", () => {
    expect(cnpjValido("12.345.678/0001-95")).toBe(true);
    expect(cnpjValido("12345678000195")).toBe(false);
    expect(cnpjValido("12.345.678/0001-9")).toBe(false);
    expect(cnpjValido("")).toBe(false);
  });

  test("telefone válido em (XX) XXXXX-XXXX e (XX) XXXX-XXXX", () => {
    expect(telefoneValido("(61) 91234-5678")).toBe(true);
    expect(telefoneValido("(61) 3123-4567")).toBe(true);
    expect(telefoneValido("61912345678")).toBe(false);
  });

  test("email válido (simples)", () => {
    expect(emailValido("paciente@email.com")).toBe(true);
    expect(emailValido(" pacote@email.com.br ")).toBe(true);
    expect(emailValido("sem-arroba")).toBe(false);
  });
});

describe("utils/format — máscaras (Épico 01)", () => {
  test("mascararCnpj formata progressivamente", () => {
    expect(mascararCnpj("")).toBe("");
    expect(mascararCnpj("123")).toBe("12.3");
    expect(mascararCnpj("12.345.678/0001-95")).toBe("12.345.678/0001-95");
    expect(mascararCnpj("12345678000195")).toBe("12.345.678/0001-95");
  });

  test("mascararCep formata XXXXX-XXX", () => {
    expect(mascararCep("")).toBe("");
    expect(mascararCep("72000")).toBe("72000");
    expect(mascararCep("720001").replace("-", "") === "720001" || mascararCep("720001") === "72000-1").toBe(true);
    expect(mascararCep("72000010")).toBe("72000-010");
  });
});
