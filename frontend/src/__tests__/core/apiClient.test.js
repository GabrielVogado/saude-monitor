/**
 * Cliente HTTP único (auditoria técnica v4, §4.1): contrato de erro `ApiError`,
 * renovação de sessão injetada e repasse de `signal`/`idempotente`.
 */
import {
  apiRequest,
  buildQuery,
  configurarSessao,
  renovarSessaoAposNaoAutorizado,
} from "../../core/api/apiClient";
import { ApiError } from "../../core/api/apiError";
import { reiniciarControleDeRenovacao } from "../../config/sessao";
import { ErroServidorIndisponivel } from "../../config/http";
import TokenStorage from "../../services/TokenStorage";

process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";

function resposta(body, status = 200) {
  const raw = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
  return { ok: status < 400, status, headers: { get: () => null }, text: async () => raw };
}

describe("apiClient", () => {
  const renovar = jest.fn();
  const encerrar = jest.fn();

  beforeEach(() => {
    require("@react-native-async-storage/async-storage").default.__reset();
    reiniciarControleDeRenovacao();
    renovar.mockReset();
    encerrar.mockReset();
    configurarSessao({ renovar, encerrar });
  });

  test("devolve o corpo JSON e monta a URL a partir da base da API", async () => {
    global.fetch = jest.fn().mockResolvedValue(resposta({ id: 1 }));

    await expect(apiRequest("/api/v1/x")).resolves.toEqual({ id: 1 });
    expect(global.fetch.mock.calls[0][0]).toBe("https://api.test/api/v1/x");
    expect(global.fetch.mock.calls[0][1].method).toBe("GET");
  });

  test("corpo vazio ou que não é JSON vira null", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(resposta(undefined, 204)).mockResolvedValueOnce(resposta("<html>"));

    await expect(apiRequest("/a")).resolves.toBeNull();
    await expect(apiRequest("/b")).resolves.toBeNull();
  });

  test("serializa o corpo em JSON e repassa string intacta", async () => {
    global.fetch = jest.fn().mockResolvedValue(resposta({}));

    await apiRequest("/a", { method: "POST", body: { nota: 5 } });
    await apiRequest("/b", { method: "POST", body: "cru" });

    expect(global.fetch.mock.calls[0][1].body).toBe('{"nota":5}');
    expect(global.fetch.mock.calls[1][1].body).toBe("cru");
  });

  test("anexa Authorization só quando há access token", async () => {
    global.fetch = jest.fn().mockResolvedValue(resposta({}));

    await apiRequest("/a");
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();

    await TokenStorage.salvarTokens({ accessToken: "TOK", refreshToken: "R" });
    await apiRequest("/a", { headers: { "X-Extra": "1" } });
    expect(global.fetch.mock.calls[1][1].headers).toMatchObject({ Authorization: "Bearer TOK", "X-Extra": "1" });
  });

  test("resposta fora de 2xx vira ApiError com status, data e a mensagem do servidor", async () => {
    global.fetch = jest.fn().mockResolvedValue(resposta({ message: "Hospital não encontrado." }, 404));

    const erro = await apiRequest("/a").catch((e) => e);

    expect(erro).toBeInstanceOf(ApiError);
    expect(erro.message).toBe("Hospital não encontrado.");
    expect(erro.status).toBe(404);
    expect(erro.data).toEqual({ message: "Hospital não encontrado." });
  });

  test("sem mensagem no corpo, usa `error` e depois o texto padrão com o status", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(resposta({ error: "Conflict" }, 409))
      .mockResolvedValueOnce(resposta(undefined, 400));

    await expect(apiRequest("/a")).rejects.toThrow("Conflict");
    await expect(apiRequest("/a")).rejects.toThrow("Falha na requisição (HTTP 400).");
  });

  test("repassa o AbortSignal e o cancelamento chega como AbortError", async () => {
    const controle = new AbortController();
    global.fetch = jest.fn((url, config) => {
      expect(config.signal).toBeDefined();
      // Como o fetch real: sinal já abortado rejeita na hora; senão, ao abortar.
      return new Promise((resolve, reject) => {
        const rejeitar = () => {
          const erro = new Error("Aborted");
          erro.name = "AbortError";
          reject(erro);
        };
        if (config.signal.aborted) {
          rejeitar();
        } else {
          config.signal.addEventListener("abort", rejeitar);
        }
      });
    });

    const pendente = apiRequest("/a", { signal: controle.signal });
    controle.abort();

    await expect(pendente).rejects.toMatchObject({ name: "AbortError" });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("POST com idempotente: true é repetido em 503", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    global.fetch = jest.fn().mockResolvedValueOnce(resposta({}, 503)).mockResolvedValueOnce(resposta({ ok: 1 }));

    await expect(apiRequest("/a", { method: "POST", body: {}, idempotente: true })).resolves.toEqual({ ok: 1 });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    Math.random.mockRestore();
  });

  test("POST sem idempotente não é repetido em 503", async () => {
    global.fetch = jest.fn().mockResolvedValue(resposta({}, 503));

    await expect(apiRequest("/a", { method: "POST", body: {} })).rejects.toMatchObject({ status: 503 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("falha de transporte chega classificada (servidor indisponível)", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Network request failed"));

    await expect(apiRequest("/a", { method: "POST" })).rejects.toBeInstanceOf(ErroServidorIndisponivel);
  });

  test("401 com refresh token renova uma vez e repete com o token novo", async () => {
    await TokenStorage.salvarTokens({ accessToken: "OLD", refreshToken: "R" });
    renovar.mockImplementation(async () => {
      await TokenStorage.salvarTokens({ accessToken: "NEW", refreshToken: "R2" });
    });
    global.fetch = jest.fn().mockResolvedValueOnce(resposta({}, 401)).mockResolvedValueOnce(resposta({ ok: true }));

    await expect(apiRequest("/a")).resolves.toEqual({ ok: true });
    expect(renovar).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe("Bearer NEW");
  });

  test("401 sem refresh token não renova e devolve o erro do servidor", async () => {
    global.fetch = jest.fn().mockResolvedValue(resposta({ message: "Não autenticado." }, 401));

    await expect(apiRequest("/a")).rejects.toMatchObject({ status: 401, message: "Não autenticado." });
    expect(renovar).not.toHaveBeenCalled();
  });

  test("refresh rejeitado pelo servidor encerra a sessão e lança 'Sessão expirada'", async () => {
    await TokenStorage.salvarTokens({ accessToken: "OLD", refreshToken: "R" });
    renovar.mockRejectedValue(Object.assign(new Error("Refresh inválido"), { status: 401 }));
    global.fetch = jest.fn().mockResolvedValue(resposta({}, 401));

    const erro = await apiRequest("/a").catch((e) => e);

    expect(erro).toBeInstanceOf(ApiError);
    expect(erro.status).toBe(401);
    expect(erro.message).toBe("Sessão expirada. Faça login novamente.");
    expect(encerrar).toHaveBeenCalledTimes(1);
  });

  test("refresh com servidor indisponível preserva a sessão e propaga a falha", async () => {
    await TokenStorage.salvarTokens({ accessToken: "OLD", refreshToken: "R" });
    const indisponivel = new ErroServidorIndisponivel("https://api.test/api/v1/auth/refresh");
    renovar.mockRejectedValue(indisponivel);
    global.fetch = jest.fn().mockResolvedValue(resposta({}, 401));

    await expect(apiRequest("/a")).rejects.toBe(indisponivel);
    expect(encerrar).not.toHaveBeenCalled();
  });

  test("sem sessão configurada, um 401 com refresh token vira 'Sessão expirada' sem renovar", async () => {
    configurarSessao();
    await TokenStorage.salvarTokens({ accessToken: "OLD", refreshToken: "R" });
    global.fetch = jest.fn().mockResolvedValue(resposta({}, 401));

    await expect(apiRequest("/a")).rejects.toMatchObject({ status: 401, message: "Sessão expirada. Faça login novamente." });
    await expect(renovarSessaoAposNaoAutorizado(0)).rejects.toBeInstanceOf(ApiError);
  });

  test("buildQuery omite vazios e codifica valores", () => {
    expect(buildQuery({ busca: "são josé", tipo: "", page: 0, x: null, y: undefined })).toBe(
      "?busca=s%C3%A3o%20jos%C3%A9&page=0"
    );
    expect(buildQuery()).toBe("");
  });
});
