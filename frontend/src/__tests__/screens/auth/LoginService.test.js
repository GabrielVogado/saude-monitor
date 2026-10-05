/**
 * Autenticação (Fase 0 / Épico 01) — LoginService.
 * Contrato §3.1: login/refresh retornam { accessToken, refreshToken, expiraEm, usuario };
 * usuário ADMIN é bloqueado no mobile (F-11).
 */
import * as Network from "expo-network";

import LoginService from "../../../screens/auth/service/LoginService";
import TokenStorage from "../../../services/TokenStorage";
import { pararGeofencing } from "../../../screens/visitas/service/GeofencingTaskService";
import { limparPendencias } from "../../../screens/feedback/service/FeedbackNotificationService";
import * as httpModule from "../../../config/http";
// Liga o cliente HTTP ao LoginService real, como o index.js faz no app.
import "../../../core/api/sessaoApi";
import { reiniciarControleDeRenovacao } from "../../../config/sessao";

jest.mock("../../../screens/visitas/service/GeofencingTaskService", () => ({
  pararGeofencing: jest.fn(),
}));
jest.mock("../../../screens/feedback/service/FeedbackNotificationService", () => ({
  limparPendencias: jest.fn(),
}));

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
    // achado da auditoria (08/09/2026): o geofencing nativo não era parado no
    // logout e continuava monitorando regiões após a sessão encerrar
    expect(pararGeofencing).toHaveBeenCalledTimes(1);
    // avaliações pendentes carregam o hospital visitado (dado de saúde): não ficam
    // para a próxima pessoa que usar o aparelho
    expect(limparPendencias).toHaveBeenCalledTimes(1);
  });

  test("logout é best-effort: falha ao apagar as avaliações pendentes ainda limpa a sessão", async () => {
    await TokenStorage.salvarTokens({ accessToken: "A", refreshToken: "R", usuario: { id: "u1" } });
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ success: true }));
    limparPendencias.mockRejectedValueOnce(new Error("disco"));

    await LoginService.logout();

    expect(await TokenStorage.getAccessToken()).toBeNull();
  });

  test("logout é best-effort: falha de rede ainda limpa a sessão local", async () => {
    await TokenStorage.salvarTokens({ accessToken: "A", refreshToken: "R", usuario: { id: "u1" } });
    global.fetch = jest.fn().mockRejectedValue(new Error("Network request failed"));

    await LoginService.logout();

    // revogação falhou, mas o logout local não pode ficar bloqueado
    expect(await TokenStorage.getAccessToken()).toBeNull();
    expect(await TokenStorage.getRefreshToken()).toBeNull();
  });

  test("logout é best-effort: falha ao parar o geofencing ainda limpa a sessão local", async () => {
    await TokenStorage.salvarTokens({ accessToken: "A", refreshToken: "R", usuario: { id: "u1" } });
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ success: true }));
    pararGeofencing.mockRejectedValueOnce(new Error("TaskManager indisponível"));

    await LoginService.logout();

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
    expect(pararGeofencing).toHaveBeenCalledTimes(1);
    expect(limparPendencias).toHaveBeenCalledTimes(1);
  });

  test("excluirConta sem sessão lança erro", async () => {
    await expect(LoginService.excluirConta()).rejects.toThrow("Sessão expirada");
  });

  test("excluirConta propaga erro da API", async () => {
    await TokenStorage.salvarTokens({ accessToken: "TOK" });
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ message: "Falha ao excluir a conta: erro interno" }, 500));
    await expect(LoginService.excluirConta()).rejects.toThrow("Falha ao excluir a conta");
  });

  test("excluirConta com access token vencido renova a sessão e conclui a exclusão (auditoria v4 §4.1)", async () => {
    reiniciarControleDeRenovacao();
    await TokenStorage.salvarTokens({ accessToken: "OLD", refreshToken: "RT", usuario: { id: "u1" } });
    global.fetch = jest.fn(async (url, config) => {
      if (url.endsWith("/auth/refresh")) {
        return jsonResponse({ accessToken: "NEW", refreshToken: "RT2", usuario: { id: "u1" } });
      }
      return config.headers.Authorization === "Bearer NEW"
        ? jsonResponse({ success: true })
        : jsonResponse({ message: "Token expirado" }, 401);
    });

    const resp = await LoginService.excluirConta();

    expect(resp.success).toBe(true);
    const exclusoes = global.fetch.mock.calls.filter(([url]) => url.endsWith("/contas/exclusao"));
    expect(exclusoes).toHaveLength(2);
    expect(await TokenStorage.getAccessToken()).toBeNull();
  });

  test("excluirConta com refresh rejeitado encerra a sessão e não exclui", async () => {
    reiniciarControleDeRenovacao();
    await TokenStorage.salvarTokens({ accessToken: "OLD", refreshToken: "RT" });
    global.fetch = jest.fn(async (url) =>
      url.endsWith("/contas/exclusao") || url.endsWith("/auth/refresh")
        ? jsonResponse({ message: "Token inválido" }, 401)
        : jsonResponse({})
    );

    await expect(LoginService.excluirConta()).rejects.toMatchObject({
      status: 401,
      message: "Sessão expirada. Faça login novamente.",
    });
    expect(await TokenStorage.getRefreshToken()).toBeNull();
    expect(pararGeofencing).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------ Esqueci minha senha (E8-05/BUG-03) ---

  test("esqueciSenha envia o e-mail (sem espaços) para /auth/esqueci-senha", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, message: "Se o e-mail existir, você receberá um código de redefinição." })
    );

    const resp = await LoginService.esqueciSenha("  marina@email.com  ");

    const [url, config] = global.fetch.mock.calls[0];
    expect(url).toContain("/api/v1/auth/esqueci-senha");
    expect(config.method).toBe("POST");
    expect(JSON.parse(config.body).email).toBe("marina@email.com");
    expect(resp.success).toBe(true);
  });

  test("esqueciSenha marca a chamada como idempotente (retry seguro em 502/503/504)", async () => {
    // O backend faz upsert por e-mail: reenviar só troca o código, nunca deixa dois
    // códigos ativos — seguro repetir em cold start (achado de 10/09/2026).
    const spy = jest
      .spyOn(httpModule, "fetchComRetry")
      .mockResolvedValue(jsonResponse({ success: true }));

    await LoginService.esqueciSenha("marina@email.com");

    expect(spy).toHaveBeenCalledWith(expect.any(String), expect.any(Object), { idempotente: true });
    spy.mockRestore();
  });

  test("redefinirSenha envia email/codigo/novaSenha para /auth/redefinir-senha", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, message: "Senha redefinida com sucesso." })
    );

    const resp = await LoginService.redefinirSenha({
      email: " marina@email.com ",
      codigo: " 123456 ",
      novaSenha: "N0vaSenha!",
    });

    const [url, config] = global.fetch.mock.calls[0];
    expect(url).toContain("/api/v1/auth/redefinir-senha");
    const body = JSON.parse(config.body);
    expect(body.email).toBe("marina@email.com");
    expect(body.codigo).toBe("123456");
    expect(body.novaSenha).toBe("N0vaSenha!");
    expect(resp.success).toBe(true);
  });

  test("redefinirSenha NÃO marca a chamada como idempotente", async () => {
    // Diferente de esqueciSenha: repetir depois que o código já foi consumido
    // devolveria um erro confuso — o usuário decide se tenta de novo.
    const spy = jest
      .spyOn(httpModule, "fetchComRetry")
      .mockResolvedValue(jsonResponse({ success: true }));

    await LoginService.redefinirSenha({ email: "marina@email.com", codigo: "123456", novaSenha: "x" });

    expect(spy).toHaveBeenCalledWith(expect.any(String), expect.any(Object), { idempotente: false });
    spy.mockRestore();
  });

  test("redefinirSenha propaga o erro genérico de código inválido/expirado", async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ message: "Código inválido ou expirado." }, 401));

    await expect(
      LoginService.redefinirSenha({ email: "marina@email.com", codigo: "000000", novaSenha: "x" })
    ).rejects.toThrow("Código inválido ou expirado.");
  });

  // ------------------------------------------------ Confirmação de e-mail no cadastro ---

  test("confirmarEmail envia email/codigo para /auth/confirmar-email", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, message: "E-mail confirmado com sucesso." })
    );

    const resp = await LoginService.confirmarEmail({ email: " marina@email.com ", codigo: " 123456 " });

    const [url, config] = global.fetch.mock.calls[0];
    expect(url).toContain("/api/v1/auth/confirmar-email");
    const body = JSON.parse(config.body);
    expect(body.email).toBe("marina@email.com");
    expect(body.codigo).toBe("123456");
    expect(resp.success).toBe(true);
  });

  test("confirmarEmail NÃO marca a chamada como idempotente", async () => {
    const spy = jest
      .spyOn(httpModule, "fetchComRetry")
      .mockResolvedValue(jsonResponse({ success: true }));

    await LoginService.confirmarEmail({ email: "marina@email.com", codigo: "123456" });

    expect(spy).toHaveBeenCalledWith(expect.any(String), expect.any(Object), { idempotente: false });
    spy.mockRestore();
  });

  test("confirmarEmail propaga o erro genérico de código inválido/expirado", async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ message: "Código inválido ou expirado." }, 401));

    await expect(
      LoginService.confirmarEmail({ email: "marina@email.com", codigo: "000000" })
    ).rejects.toThrow("Código inválido ou expirado.");
  });

  test("reenviarConfirmacaoEmail envia o e-mail para /auth/reenviar-confirmacao", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, message: "Se o e-mail existir e ainda não estiver confirmado, você receberá um novo código." })
    );

    const resp = await LoginService.reenviarConfirmacaoEmail("  marina@email.com  ");

    const [url, config] = global.fetch.mock.calls[0];
    expect(url).toContain("/api/v1/auth/reenviar-confirmacao");
    expect(JSON.parse(config.body).email).toBe("marina@email.com");
    expect(resp.success).toBe(true);
  });

  test("reenviarConfirmacaoEmail marca a chamada como idempotente", async () => {
    const spy = jest
      .spyOn(httpModule, "fetchComRetry")
      .mockResolvedValue(jsonResponse({ success: true }));

    await LoginService.reenviarConfirmacaoEmail("marina@email.com");

    expect(spy).toHaveBeenCalledWith(expect.any(String), expect.any(Object), { idempotente: true });
    spy.mockRestore();
  });
});
