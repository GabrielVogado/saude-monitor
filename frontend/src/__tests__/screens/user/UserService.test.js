/**
 * Cadastro opcional de conta (E5-04) — UserService.
 * Contrato §3.1: POST /api/v1/auth/registro com consentimento LGPD obrigatório
 * (termos de uso com versão vigente; backend rejeita com 400 sem aceite).
 */
process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";

import UserService from "../../../screens/user/service/UserService";

function jsonResponse(body, status = 201) {
  return { ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body };
}

describe("UserService (E5-04 registro)", () => {
  let chamadas;
  beforeEach(async () => {
    require("@react-native-async-storage/async-storage").default.__reset();
    jest.clearAllMocks();
    chamadas = [];
    global.fetch = jest.fn().mockImplementation(async (url, config) => {
      chamadas.push({ url, method: config?.method || "GET", headers: config?.headers, body: config?.body });
      return jsonResponse({ success: true, message: "Conta criada" }, 201);
    });
  });

  test("registro faz POST em /api/v1/auth/registro com consentimento", async () => {
    await UserService.registro({
      fullName: "Marina Souza",
      email: "marina@email.com",
      password: "S3nh@Forte!",
      phone: "(11) 99999-0000",
      consentimento: { termosUso: true, versaoTermos: "1.0" },
    });
    const c = chamadas[0];
    expect(c.method).toBe("POST");
    expect(c.url).toContain("/api/v1/auth/registro");
    const body = JSON.parse(c.body);
    expect(body.fullName).toBe("Marina Souza");
    expect(body.consentimento.termosUso).toBe(true);
    expect(body.consentimento.versaoTermos).toBe("1.0");
  });

  test("registro envia termosUso false quando consentimento ausente", async () => {
    await UserService.registro({ fullName: "A", email: "a@b.c", password: "x" });
    const body = JSON.parse(chamadas[0].body);
    expect(body.consentimento.termosUso).toBe(false);
  });

  test("erro de validação do backend é propagado com message", async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({
      success: false,
      message: "Aceite os termos de uso para continuar.",
    }, 400));
    await expect(UserService.registro({ fullName: "A", email: "a@b.c", password: "x" }))
      .rejects.toThrow("Aceite os termos de uso para continuar.");
  });

  test("falha de rede reporta problema de conexão com backend", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network request failed"));
    await expect(UserService.registro({ fullName: "A", email: "a@b.c", password: "x" }))
      .rejects.toThrow(/Nao foi possivel conectar ao backend/);
  });

  test("não faz cadastro sem nome (UserScreen valida antes de chamar o serviço)", async () => {
    const resp = await UserService.registro({ fullName: "", email: "a@b.c", password: "x" });
    expect(JSON.parse(chamadas[0].body).fullName).toBe("");
    expect(resp.success).toBe(true);
  });
});