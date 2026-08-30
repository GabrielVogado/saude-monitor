/**
 * Cliente de Hospitais (Épico 01) — listagem pública, sugestão, auth e retry 401.
 * Contrato §3.2: GET /api/v1/hospitais (público F-03), POST /api/v1/hospitais/sugestoes (E1-05 P2).
 */
process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";

import HospitalService from "../../../screens/hospitais/service/HospitalService";
import TokenStorage from "../../../services/TokenStorage";
import LoginService from "../../../screens/auth/service/LoginService";

jest.mock("../../../screens/auth/service/LoginService");

function jsonResponse(body, status = 200) {
  return { ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body };
}

describe("HospitalService (Épico 01)", () => {
  const capturada = { pathname: "", search: "" };
  beforeEach(async () => {
    require("@react-native-async-storage/async-storage").default.__reset();
    jest.clearAllMocks();
    capturada.pathname = "";
    capturada.search = "";
    global.fetch = jest.fn().mockImplementation(async (url, config) => {
      const u = new URL(url);
      capturada.pathname = u.pathname;
      capturada.search = u.search;
      return jsonResponse({ content: [] });
    });
  });

  test("listar monta a URL pública correta com query", async () => {
    await HospitalService.listar({ latitude: -15.79, longitude: -47.88, raioKm: 5, size: 50 });
    expect(capturada.pathname).toBe("/api/v1/hospitais");
    expect(capturada.search).toContain("latitude=-15.79");
    expect(capturada.search).toContain("raioKm=5");
    expect(capturada.search).toContain("size=50");
  });

  test("listar omite parâmetros vazios/undefined", async () => {
    await HospitalService.listar({ size: 20 });
    expect(capturada.search).toContain("size=20");
    expect(capturada.search).not.toContain("latitude");
  });

  test("public apps não enviam Authorization sem sessão", async () => {
    await HospitalService.listar({ size: 10 });
    const [, config] = global.fetch.mock.calls[0];
    expect(config.headers.Authorization).toBeUndefined();
  });

  test("anexa Authorization Bearer quando há token", async () => {
    await TokenStorage.salvarTokens({ accessToken: "TOK", refreshToken: "R" });
    await HospitalService.listar({ size: 10 });
    const [, config] = global.fetch.mock.calls[0];
    expect(config.headers.Authorization).toBe("Bearer TOK");
  });

  test("sugestão é POST público no caminho /api/v1/hospitais/sugestoes (E1-05)", async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ id: "s1" }, 201));
    const resp = await HospitalService.sugerir({ nome: "Policlínica", cnpj: "12.345.678/0001-95" });
    expect(global.fetch.mock.calls[0][0]).toContain("/api/v1/hospitais/sugestoes");
    expect(global.fetch.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).nome).toBe("Policlínica");
    expect(resp.id).toBe("s1");
  });

  test("erro não-ok lança a mensagem do envelope (com HTTP sem mensagem)", async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ message: "Hospital não encontrado." }, 404));
    await expect(HospitalService.buscarPorId("nao-existe")).rejects.toThrow("Hospital não encontrado.");
  });

  test("401 renova o token via refresh e tenta novamente uma vez", async () => {
    await TokenStorage.salvarTokens({ accessToken: "OLD", refreshToken: "R" });
    LoginService.refresh.mockResolvedValue({ accessToken: "NEW", refreshToken: "R2" });

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "expirado" }, 401))
      .mockResolvedValueOnce(jsonResponse({ content: [] }));

    await HospitalService.listar({ size: 10 });
    expect(LoginService.refresh).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("401 sem refresh token NÃO tenta renovar e lança o envelope de erro", async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ message: "Token inválido ou expirado." }, 401));
    await expect(HospitalService.listar({ size: 10 })).rejects.toThrow("Token inválido ou expirado.");
    // apenas 1 chamada (sem retry)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
