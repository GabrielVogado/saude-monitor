/**
 * Autenticação (Fase 0 / Épico 01) — LoginService.
 * Contrato §3.1: login/refresh retornam { accessToken, refreshToken, expiraEm, usuario };
 * usuário ADMIN é bloqueado no mobile (F-11).
 */
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
    TokenStorage.salvarTokens({ accessToken: "OLD", refreshToken: "RREF" });
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

  test("logout limpa a sessão", async () => {
    await TokenStorage.salvarTokens({ accessToken: "A", refreshToken: "R", usuario: { id: "u1" } });
    await LoginService.logout();
    expect(await TokenStorage.getAccessToken()).toBeNull();
  });

  test("erro de rede vira mensagem pt-BR amigável", async () => {
    const erro = new Error("Network request failed");
    global.fetch = jest.fn().mockRejectedValue(erro);
    await expect(LoginService.login({ email: "a@b.com", password: "x" })).rejects.toThrow(
      "Não foi possível conectar ao backend"
    );
  });
});
