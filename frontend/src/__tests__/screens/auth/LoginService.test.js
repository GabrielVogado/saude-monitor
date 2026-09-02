/**
 * Autenticação (Fase 0 / Épico 01) — LoginService.
 * Contrato §3.1: login/refresh retornam { accessToken, refreshToken, expiraEm, usuario };
 * usuário ADMIN é bloqueado no mobile (F-11).
 */
import * as Network from "expo-network";

import LoginService from "../../../screens/auth/service/LoginService";
import TokenStorage from "../../../services/TokenStorage";

function jsonResponse(body, status = 200) {
  return { ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) };
}

describe("LoginService (Fase 0)", () => {
  beforeEach(async () => {
    require("@react-native-async-storage/async-storage").default.__reset();
    jest.clearAllMocks();
  });

  test("login envia credenciais e persiste tokens + usuário", async () => {
    const usuario = { id: "u1", nome: "Ana", papel: "USUARIO" };
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ accessToken: "AT", refreshToken: "RT", expiraEm: 3600, usuario })
    );

    const resp = await LoginService.login({ email: "  ana@email.com ", password: "123", rememberDevice: true });

    const [, config] = global.fetch.mock.calls[0];
    const body = JSON.parse(config.body);
    expect(body.email).toBe("ana@email.com");
    expect(body.rememberDevice).toBe(true);
    expect(resp.accessToken).toBe("AT");
    expect(await TokenStorage.getAccessToken()).toBe("AT");
    expect(await TokenStorage.getUsuario()).toEqual(usuario);
  });

  test("bloqueia usuário ADMIN (acesso apenas pelo painel web, F-11)", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ accessToken: "AT", refreshToken: "RT", expiraEm: 3600, usuario: { papel: "ADMIN" } })
    );
    await expect(LoginService.login({ email: "adm@email.com", password: "x" })).rejects.toThrow(
      "Acesso administrativo disponível apenas pelo Painel Administrativo Web"
    );
    // não persiste tokens num login bloqueado
    expect(await TokenStorage.getAccessToken()).toBeNull();
  });

  test("refresh rotaciona o par de tokens", async () => {
    await TokenStorage.salvarTokens({ accessToken: "OLD", refreshToken: "RREF" });
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ accessToken: "NEW", refreshToken: "NEWREF", expiraEm: 3600, usuario: { id: "u1" } })
    );
    const resp = await LoginService.refresh();
    expect(resp.accessToken).toBe("NEW");
    expect(await TokenStorage.getAccessToken()).toBe("NEW");
    expect(await TokenStorage.getRefreshToken()).toBe("NEWREF");
  });

  test("refresh sem refresh token lança erro de sessão expirada", async () => {
    await expect(LoginService.refresh()).rejects.toThrow("Sessão expirada");
  });

  test("logout revoga o refresh token no servidor e limpa a sessão", async () => {
    await TokenStorage.salvarTokens({ accessToken: "A", refreshToken: "R", usuario: { id: "u1" } });
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ success: true, message: "ok" }));

    await LoginService.logout();

    // revoga o refresh no backend antes de limpar localmente (§3.1)
    const [url, config] = global.fetch.mock.calls[0];
    expect(url).toContain("/api/v1/auth/logout");
    expect(config.method).toBe("POST");
    expect(JSON.parse(config.body).refreshToken).toBe("R");
    expect(await TokenStorage.getAccessToken()).toBeNull();
    expect(await TokenStorage.getRefreshToken()).toBeNull();
  });

  test("logout é best-effort: falha de rede ainda limpa a sessão local", async () => {
    await TokenStorage.salvarTokens({ accessToken: "A", refreshToken: "R", usuario: { id: "u1" } });
    global.fetch = jest.fn().mockRejectedValue(new Error("Network request failed"));

    await LoginService.logout();

    // revogação falhou, mas o logout local não pode ficar bloqueado
    expect(await TokenStorage.getAccessToken()).toBeNull();
    expect(await TokenStorage.getRefreshToken()).toBeNull();
  });

  test("logout sem sessão só limpa (não chama o backend)", async () => {
    global.fetch = jest.fn();
    await LoginService.logout();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("erro de rede sem internet culpa a conexão do usuário (E8-04)", async () => {
    Network.getNetworkStateAsync.mockResolvedValue({ isConnected: false, isInternetReachable: false });
    global.fetch = jest.fn().mockRejectedValue(new Error("Network request failed"));
    await expect(LoginService.login({ email: "a@b.com", password: "x" })).rejects.toThrow(
      /sem conexão com a internet/i
    );
  });

  test("erro de rede com internet culpa o servidor (E8-04)", async () => {
    Network.getNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    global.fetch = jest.fn().mockRejectedValue(new Error("Network request failed"));
    await expect(LoginService.login({ email: "a@b.com", password: "x" })).rejects.toThrow(
      /servidor está indisponível/i
    );
  });

  test("excluirConta envia DELETE autenticado em /api/v1/contas/exclusao e limpa a sessão", async () => {
    await TokenStorage.salvarTokens({ accessToken: "TOK", refreshToken: "RT", usuario: { id: "u1" } });
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, message: "Conta excluída com sucesso." })
    );

    const resp = await LoginService.excluirConta();

    const [url, config] = global.fetch.mock.calls[0];
    expect(url).toContain("/api/v1/contas/exclusao");
    expect(config.method).toBe("DELETE");
    expect(config.headers.Authorization).toBe("Bearer TOK");
    expect(resp.success).toBe(true);
    // após a exclusão a sessão local é removida (logout)
    expect(await TokenStorage.getAccessToken()).toBeNull();
  });

  test("excluirConta sem sessão lança erro", async () => {
    await expect(LoginService.excluirConta()).rejects.toThrow("Sessão expirada");
  });

  test("excluirConta propaga erro da API", async () => {
    await TokenStorage.salvarTokens({ accessToken: "TOK" });
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ message: "Falha ao excluir a conta: erro interno" }, 500));
    await expect(LoginService.excluirConta()).rejects.toThrow("Falha ao excluir a conta");
  });
});
