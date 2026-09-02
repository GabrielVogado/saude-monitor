import * as Network from "expo-network";

import {
  ErroDeTimeout,
  ErroSemInternet,
  ErroServidorIndisponivel,
  TIMEOUT_PADRAO_MS,
  classificarErroDeRede,
  ehFalhaDeRede,
  fetchComTimeout,
} from "../../config/http";

jest.mock("expo-network", () => ({
  getNetworkStateAsync: jest.fn(),
}));

/** Substitui `navigator.onLine` e devolve a função que restaura o original. */
const fixarNavigatorOnLine = (valor) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: valor === undefined ? {} : { onLine: valor },
  });

  return () => {
    if (original) {
      Object.defineProperty(globalThis, "navigator", original);
    } else {
      delete globalThis.navigator;
    }
  };
};

describe("E8-04 — fetch com timeout explícito", () => {
  const fetchOriginal = global.fetch;

  beforeEach(() => {
    // Sem resposta do módulo de rede, a classificação cai no caminho
    // conservador — é o cenário dos testes que não tratam de conectividade.
    Network.getNetworkStateAsync.mockResolvedValue({});
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("devolve a resposta quando o servidor responde dentro do prazo", async () => {
    const resposta = { ok: true, status: 200 };
    global.fetch = jest.fn().mockResolvedValue(resposta);

    await expect(fetchComTimeout("https://api/teste")).resolves.toBe(resposta);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("repassa um AbortSignal ao fetch, para permitir o cancelamento", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    await fetchComTimeout("https://api/teste", { method: "POST" });

    const [, config] = global.fetch.mock.calls[0];
    expect(config.method).toBe("POST");
    expect(config.signal).toBeInstanceOf(AbortSignal);
    expect(config.signal.aborted).toBe(false);
  });

  it("lança ErroDeTimeout quando o prazo estoura", async () => {
    // Um fetch que só rejeita quando abortado é o que o React Native faz de
    // fato: sem o timeout, esta promessa nunca se resolveria.
    global.fetch = jest.fn(
      (_url, config) =>
        new Promise((_resolve, reject) => {
          config.signal.addEventListener("abort", () =>
            reject(new Error("Aborted"))
          );
        })
    );

    await expect(fetchComTimeout("https://api/lenta", {}, 20)).rejects.toThrow(
      ErroDeTimeout
    );
  });

  it("informa o tempo decorrido em segundos na mensagem de erro", async () => {
    global.fetch = jest.fn(
      (_url, config) =>
        new Promise((_resolve, reject) => {
          config.signal.addEventListener("abort", () =>
            reject(new Error("Aborted"))
          );
        })
    );

    await expect(
      fetchComTimeout("https://api/lenta", {}, 1000)
    ).rejects.toThrow(/1 segundos/);
  });

  it("preserva o erro original quando a falha não é de rede", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("JSON inválido"));

    await expect(fetchComTimeout("https://api/teste")).rejects.toThrow(
      "JSON inválido"
    );
  });

  it("respeita um signal externo, distinguindo cancelamento de timeout", async () => {
    const externo = new AbortController();
    global.fetch = jest.fn(
      (_url, config) =>
        new Promise((_resolve, reject) => {
          config.signal.addEventListener("abort", () =>
            reject(new Error("Aborted"))
          );
        })
    );

    const promessa = fetchComTimeout("https://api/teste", {
      signal: externo.signal,
    });
    externo.abort();

    await expect(promessa).rejects.toThrow("Aborted");
  });

  it("expõe um teto padrão compatível com a latência medida do backend", () => {
    expect(TIMEOUT_PADRAO_MS).toBeGreaterThan(5000);
    expect(TIMEOUT_PADRAO_MS).toBeLessThanOrEqual(30000);
  });
});

describe("E8-04 — distinção entre sem internet e servidor indisponível", () => {
  const fetchOriginal = global.fetch;
  let restaurarNavigator = () => {};

  beforeEach(() => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("Network request failed"));
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
    restaurarNavigator();
    restaurarNavigator = () => {};
    jest.clearAllMocks();
  });

  it("lança ErroSemInternet quando o dispositivo está desconectado", async () => {
    Network.getNetworkStateAsync.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });

    const erro = await fetchComTimeout("https://api/teste").catch((e) => e);

    expect(erro).toBeInstanceOf(ErroSemInternet);
    expect(erro.message).toMatch(/sem conexão com a internet/i);
    expect(erro.url).toBe("https://api/teste");
  });

  it("lança ErroSemInternet no Wi-Fi sem saída para a internet", async () => {
    // Conectado ao roteador, mas sem alcançar a internet: para o usuário, o
    // problema é a conexão dele, não o servidor.
    Network.getNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: false,
    });

    await expect(fetchComTimeout("https://api/teste")).rejects.toBeInstanceOf(
      ErroSemInternet
    );
  });

  it("lança ErroServidorIndisponivel quando há internet e o servidor recusa", async () => {
    Network.getNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });

    const erro = await fetchComTimeout("https://api/teste").catch((e) => e);

    expect(erro).toBeInstanceOf(ErroServidorIndisponivel);
    expect(erro.message).toMatch(/servidor está indisponível/i);
  });

  it("usa navigator.onLine quando o módulo de rede não responde", async () => {
    Network.getNetworkStateAsync.mockRejectedValue(
      new Error("módulo indisponível")
    );
    restaurarNavigator = fixarNavigatorOnLine(false);

    await expect(fetchComTimeout("https://api/teste")).rejects.toBeInstanceOf(
      ErroSemInternet
    );
  });

  it("trata a falha como servidor indisponível quando a conectividade é desconhecida", async () => {
    // Nada nega a conectividade: culpar a internet do usuário seria um palpite
    // pior do que apontar o servidor, que é a causa que já medimos.
    Network.getNetworkStateAsync.mockResolvedValue({});
    restaurarNavigator = fixarNavigatorOnLine(undefined);

    await expect(fetchComTimeout("https://api/teste")).rejects.toBeInstanceOf(
      ErroServidorIndisponivel
    );
  });

  it("reconhece as mensagens de falha de rede de cada plataforma", () => {
    expect(ehFalhaDeRede(new Error("Network request failed"))).toBe(true);
    expect(ehFalhaDeRede(new TypeError("Failed to fetch"))).toBe(true);
    expect(ehFalhaDeRede(new Error("NetworkError when attempting"))).toBe(true);
    expect(ehFalhaDeRede(new Error("Unexpected token < in JSON"))).toBe(false);
  });

  it("não reclassifica um erro que já foi classificado", async () => {
    const original = new ErroDeTimeout("https://api/teste", 20000);

    await expect(
      classificarErroDeRede(original, "https://api/teste")
    ).resolves.toBe(original);
  });
});
