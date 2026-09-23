import * as Network from "expo-network";

import {
  BACKOFF_TETO_MS,
  ErroDeTimeout,
  ErroSemInternet,
  ErroServidorIndisponivel,
  atrasoDoBackoff,
  fetchComRetry,
} from "../../config/http";

jest.mock("expo-network", () => ({
  getNetworkStateAsync: jest.fn(),
}));

/**
 * OPS-05 — repetição com backoff.
 *
 * Os testes usam `backoffBaseMs: 0` para não introduzir espera real na suíte: o
 * que está sob verificação é **quando** o cliente repete e quantas vezes, não a
 * duração da pausa. O cálculo da pausa é verificado à parte, em `atrasoDoBackoff`.
 */

/** Resposta mínima com o formato que `fetchComRetry` inspeciona. */
const resposta = (status, cabecalhos = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (nome) => cabecalhos[nome] ?? null },
});

const falhaDeTransporte = () => new TypeError("Network request failed");

describe("OPS-05 — retry com backoff", () => {
  const fetchOriginal = global.fetch;

  beforeEach(() => {
    // Conectado: a falha de transporte é atribuída ao servidor, não ao aparelho.
    Network.getNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
    jest.clearAllMocks();
  });

  it("não repete quando a primeira tentativa já responde", async () => {
    const ok = resposta(200);
    global.fetch = jest.fn().mockResolvedValue(ok);

    await expect(fetchComRetry("https://api/hospitais")).resolves.toBe(ok);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("repete a GET que falhou por conexão e devolve a resposta da repetição", async () => {
    const ok = resposta(200);
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(falhaDeTransporte())
      .mockResolvedValueOnce(ok);

    await expect(
      fetchComRetry("https://api/hospitais", {}, { backoffBaseMs: 0 })
    ).resolves.toBe(ok);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("desiste depois das tentativas previstas e propaga o erro classificado", async () => {
    global.fetch = jest.fn().mockRejectedValue(falhaDeTransporte());

    await expect(
      fetchComRetry("https://api/hospitais", {}, { backoffBaseMs: 0 })
    ).rejects.toBeInstanceOf(ErroServidorIndisponivel);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("repete o 503 de servidor acordando", async () => {
    const ok = resposta(200);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(resposta(503))
      .mockResolvedValueOnce(ok);

    await expect(
      fetchComRetry("https://api/hospitais", {}, { backoffBaseMs: 0 })
    ).resolves.toBe(ok);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("não repete o 429: repetir só consumiria a cota de novo", async () => {
    const barrado = resposta(429);
    global.fetch = jest.fn().mockResolvedValue(barrado);

    await expect(
      fetchComRetry("https://api/hospitais", {}, { backoffBaseMs: 0 })
    ).resolves.toBe(barrado);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("não repete erro de negócio (4xx) nem resposta de sucesso", async () => {
    const naoEncontrado = resposta(404);
    global.fetch = jest.fn().mockResolvedValue(naoEncontrado);

    await expect(fetchComRetry("https://api/hospitais/x")).resolves.toBe(naoEncontrado);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("não repete POST por padrão — repetir criaria registro duplicado", async () => {
    global.fetch = jest.fn().mockRejectedValue(falhaDeTransporte());

    await expect(
      fetchComRetry("https://api/feedbacks", { method: "POST" }, { backoffBaseMs: 0 })
    ).rejects.toBeInstanceOf(ErroServidorIndisponivel);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("repete o POST que se declara idempotente (check-in, checkout)", async () => {
    const ok = resposta(200);
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(falhaDeTransporte())
      .mockResolvedValueOnce(ok);

    await expect(
      fetchComRetry(
        "https://api/visitas/checkin",
        { method: "POST" },
        { idempotente: true, backoffBaseMs: 0 }
      )
    ).resolves.toBe(ok);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("não repete quando o aparelho está sem internet — o caso é da fila offline", async () => {
    Network.getNetworkStateAsync.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });
    global.fetch = jest.fn().mockRejectedValue(falhaDeTransporte());

    await expect(
      fetchComRetry("https://api/hospitais", {}, { backoffBaseMs: 0 })
    ).rejects.toBeInstanceOf(ErroSemInternet);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("faz uma única repetição após timeout, para não somar minutos de espera", async () => {
    jest.useFakeTimers();
    // Cada tentativa estoura o prazo: o `fetch` nunca resolve e quem encerra é
    // o temporizador interno de `fetchComTimeout`.
    global.fetch = jest.fn(
      (_url, config) =>
        new Promise((_resolve, reject) => {
          config.signal.addEventListener("abort", () => reject(new Error("Aborted")));
        })
    );

    const promessa = fetchComRetry(
      "https://api/hospitais",
      {},
      { timeoutMs: 1000, backoffBaseMs: 0 }
    );
    const resultado = expect(promessa).rejects.toBeInstanceOf(ErroDeTimeout);

    // Avança o suficiente para as duas tentativas (a original e a repetição).
    await jest.advanceTimersByTimeAsync(5000);
    await resultado;

    expect(global.fetch).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});

describe("OPS-05 — cálculo do atraso", () => {
  it("cresce exponencialmente entre as tentativas", () => {
    const semJitter = () => 1;

    expect(atrasoDoBackoff(1, 500, semJitter)).toBe(500);
    expect(atrasoDoBackoff(2, 500, semJitter)).toBe(1000);
    expect(atrasoDoBackoff(3, 500, semJitter)).toBe(2000);
  });

  it("aplica jitter para não sincronizar os aparelhos que falharam juntos", () => {
    // O jitter fica entre 50% e 100% do valor exponencial: dois aparelhos que
    // falharam no mesmo instante voltam em instantes diferentes.
    expect(atrasoDoBackoff(2, 500, () => 0)).toBe(500);
    expect(atrasoDoBackoff(2, 500, () => 1)).toBe(1000);
  });

  it("respeita o teto, para que a espera não vire abandono", () => {
    expect(atrasoDoBackoff(20, 500, () => 1)).toBe(BACKOFF_TETO_MS);
  });
});
