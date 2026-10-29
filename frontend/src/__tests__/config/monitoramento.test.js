/**
 * Crash reporting (E8-07): o Sentry só liga com DSN, e nada sai do aparelho com
 * coordenada, e-mail, token ou corpo de requisição (LGPD art. 11).
 */
import * as Sentry from "@sentry/react-native";
import { NativeModules } from "react-native";
import {
  _reiniciarParaTeste,
  envolverRaiz,
  iniciarMonitoramento,
  limparBreadcrumb,
  limparEvento,
  limparTexto,
  registrarErro,
  semQueryString,
} from "../../config/monitoramento";
import { ApiError } from "../../core/api/apiError";
import { ErroEnfileirado, ErroSemInternet } from "../../config/http";

const DSN = "https://chave@o1.ingest.us.sentry.io/2";
const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.assinatura-abc_123";

beforeEach(() => {
  _reiniciarParaTeste();
});

describe("iniciarMonitoramento", () => {
  test("sem DSN não liga o Sentry", () => {
    expect(iniciarMonitoramento({ dsn: undefined })).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  test("sem DSN informado lê EXPO_PUBLIC_SENTRY_DSN, que não existe no teste", () => {
    expect(iniciarMonitoramento()).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  test("com DSN liga uma vez, só com erros e sem dado pessoal padrão", () => {
    expect(iniciarMonitoramento({ dsn: DSN, ambiente: "hom" })).toBe(true);
    expect(iniciarMonitoramento({ dsn: DSN, ambiente: "hom" })).toBe(true);

    expect(Sentry.init).toHaveBeenCalledTimes(1);
    const opcoes = Sentry.init.mock.calls[0][0];
    expect(opcoes).toMatchObject({
      dsn: DSN,
      environment: "hom",
      sendDefaultPii: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      tracesSampleRate: 0,
      beforeSend: limparEvento,
      beforeBreadcrumb: limparBreadcrumb,
      onReady: expect.any(Function),
    });
    // O release fica com o SDK, para casar com o nome usado pelo sentry.gradle no upload.
    expect(opcoes).not.toHaveProperty("release");
  });

  test("sem ambiente informado marca como dev", () => {
    iniciarMonitoramento({ dsn: DSN, ambiente: undefined });
    expect(Sentry.init.mock.calls[0][0].environment).toBe("dev");
  });
});

describe("limpeza dos eventos nativos (onReady)", () => {
  const instalar = jest.fn();

  beforeEach(() => {
    NativeModules.LimpezaSentry = { instalar };
  });

  afterEach(() => {
    delete NativeModules.LimpezaSentry;
  });

  const onReady = () => {
    iniciarMonitoramento({ dsn: DSN });
    return Sentry.init.mock.calls[0][0].onReady;
  };

  test("instala a limpeza nativa depois que o SDK nativo liga", () => {
    onReady()({ didCallNativeInit: true });
    expect(instalar).toHaveBeenCalledTimes(1);
  });

  test("sem SDK nativo ligado não chama o módulo", () => {
    onReady()({ didCallNativeInit: false });
    expect(instalar).not.toHaveBeenCalled();
  });

  test("sem o módulo nativo (iOS, Jest) não quebra", () => {
    delete NativeModules.LimpezaSentry;
    expect(() => onReady()({ didCallNativeInit: true })).not.toThrow();
  });

  test("falha do módulo nativo não derruba o app", () => {
    instalar.mockImplementationOnce(() => {
      throw new Error("módulo indisponível");
    });
    expect(() => onReady()({ didCallNativeInit: true })).not.toThrow();
  });
});

describe("envolverRaiz", () => {
  const Raiz = () => null;

  test("desligado devolve o próprio componente, sem passar pelo SDK", () => {
    expect(envolverRaiz(Raiz)).toBe(Raiz);
    expect(Sentry.wrap).not.toHaveBeenCalled();
  });

  test("ligado envolve o componente com o Sentry", () => {
    iniciarMonitoramento({ dsn: DSN });
    envolverRaiz(Raiz);
    expect(Sentry.wrap).toHaveBeenCalledWith(Raiz);
  });
});

describe("registrarErro", () => {
  test("desligado não envia nada", () => {
    registrarErro(new Error("falhou"), "geofencing.entrada");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test("ligado envia o erro com o local como tag", () => {
    iniciarMonitoramento({ dsn: DSN });
    const erro = new TypeError("undefined is not a function");

    registrarErro(erro, "geofencing.entrada");

    expect(Sentry.captureException).toHaveBeenCalledWith(erro, {
      tags: { local: "geofencing.entrada" },
    });
  });

  test("sem local envia sem tag", () => {
    iniciarMonitoramento({ dsn: DSN });
    const erro = new Error("x");
    registrarErro(erro);
    expect(Sentry.captureException).toHaveBeenCalledWith(erro, undefined);
  });

  test("400 com campo reprovado é payload montado errado pelo app e é enviado", () => {
    iniciarMonitoramento({ dsn: DSN });
    const erro = new ApiError("Requisição inválida", 400, {
      code: "CAMPOS_INVALIDOS",
      details: [{ campo: "hospitalId", mensagem: "não pode ser nulo" }],
    });
    registrarErro(erro, "geofencing.saida");
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  test("permissão de serviço em primeiro plano faltando no manifesto é defeito e é enviada", () => {
    iniciarMonitoramento({ dsn: DSN });
    const erro = Object.assign(new Error("Couldn't start the foreground service"), {
      code: "ERR_FOREGROUND_SERVICE_PERMISSIONS",
    });
    registrarErro(erro, "geofencing.acompanhamento");
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  const recusaDoSistema = (code) => Object.assign(new Error(code), { code });

  test.each([
    ["sem internet", new ErroSemInternet("/api/v1/visitas/checkin")],
    ["guardado na fila offline", new ErroEnfileirado("/api/v1/visitas/checkin")],
    ["5xx, que o backend já registra", new ApiError("Erro interno", 503)],
    ["401, sessão vencida que o refresh trata", new ApiError("Não autorizado", 401)],
    [
      "400 de posição fora do geofence (região nativa maior que o polígono, BUG-08)",
      new ApiError("A posição informada não está dentro do geofence de nenhum hospital.", 400, {
        code: "CAMPOS_INVALIDOS",
        details: [],
      }),
    ],
    ["403 de acesso negado", new ApiError("Acesso negado", 403, { code: "ACESSO_NEGADO" })],
    ["404 de hospital que saiu do catálogo", new ApiError("Não encontrado", 404)],
    ["409 de visita já aberta", new ApiError("Conflito", 409, { code: "CONFLITO" })],
    ["429 do limite de requisições", new ApiError("Limite", 429, { code: "LIMITE_EXCEDIDO" })],
    ["serviço em primeiro plano com o app em segundo plano (Android 12+)",
      recusaDoSistema("ERR_FOREGROUND_SERVICE_START_NOT_ALLOWED")],
    ["localização em segundo plano revogada", recusaDoSistema("ERR_LOCATION_BACKGROUND_UNAUTHORIZED")],
    ["localização revogada", recusaDoSistema("ERR_LOCATION_UNAUTHORIZED")],
    ["vazio", null],
  ])("não envia erro esperado: %s", (_nome, erro) => {
    iniciarMonitoramento({ dsn: DSN });
    registrarErro(erro, "geofencing.sinalVisita");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test("falha do SDK não derruba quem chamou", () => {
    iniciarMonitoramento({ dsn: DSN });
    Sentry.captureException.mockImplementationOnce(() => {
      throw new Error("SDK indisponível");
    });
    expect(() => registrarErro(new Error("x"), "geofencing.evento")).not.toThrow();
  });
});

describe("limparTexto e semQueryString", () => {
  test("troca JWT, Bearer, e-mail e coordenada", () => {
    const texto = limparTexto(
      `token ${JWT} | Bearer abc.def-1 | maria.souza@exemplo.com.br | -15.7942287,-47.8821658`
    );
    expect(texto).toBe("token [token] | Bearer [token] | [email] | [coord],[coord]");
  });

  test("não mexe em versão, inteiro nem número curto", () => {
    expect(limparTexto("versão 1.0.0-rc.10, 45 min, nota 4.5")).toBe(
      "versão 1.0.0-rc.10, 45 min, nota 4.5"
    );
  });

  test("valor que não é texto passa igual", () => {
    expect(limparTexto(42)).toBe(42);
    expect(limparTexto(undefined)).toBeUndefined();
    expect(semQueryString(null)).toBeNull();
  });

  test("tira query string e fragmento da URL", () => {
    expect(semQueryString("https://api/hospitais?lat=-15.79&lng=-47.88")).toBe("https://api/hospitais");
    expect(semQueryString("https://api/ajuda#secao")).toBe("https://api/ajuda");
    expect(semQueryString("https://api/visitas/ativas")).toBe("https://api/visitas/ativas");
  });
});

describe("limparEvento (beforeSend)", () => {
  const evento = () => ({
    message: "Falha no check-in de maria@exemplo.com",
    platform: "javascript",
    user: { id: "u-1", email: "maria@exemplo.com", ip_address: "200.1.2.3" },
    request: {
      method: "POST",
      url: "https://api/visitas/checkin?lat=-15.7942287",
      data: { posicao: { coordinates: [-47.88, -15.79] } },
      headers: { Authorization: `Bearer ${JWT}` },
      cookies: { sessao: "x" },
    },
    exception: {
      values: [
        {
          type: "Error",
          value: `Posição -15.7942287 recusada para ${JWT}`,
          stacktrace: { frames: [{ filename: "app:///index.android.bundle", lineno: 12, colno: 3 }] },
        },
      ],
    },
    extra: {
      posicao: { type: "Point", coordinates: [-47.88, -15.79] },
      latitude: -15.79,
      dispositivoId: "abc-123",
      nome: "Maria Souza",
      telefone: "61999990000",
      tentativa: 2,
      profundo: { a: { b: { c: { d: { e: { f: { g: { h: "fundo" } } } } } } } },
    },
    contexts: { device: { model: "moto g54", family: "Android" } },
  });

  test("do usuário fica só o código aleatório da instalação, sem IP nem e-mail", () => {
    expect(limparEvento(evento()).user).toEqual({ id: "u-1" });
  });

  test("usuário sem id não vira um objeto vazio", () => {
    expect(limparEvento({ message: "x", user: { ip_address: "200.1.2.3" } })).not.toHaveProperty("user");
  });

  test("coordenada guardada como número em campo de outro nome também sai", () => {
    const { extra } = limparEvento({
      extra: { centro: [-46.6333094, -23.5505199], args: ["aviso", -15.7942287], nota: 4.5 },
    });
    expect(extra.centro).toEqual(["[coord]", "[coord]"]);
    expect(extra.args).toEqual(["aviso", "[coord]"]);
    expect(extra.nota).toBe(4.5);
  });

  test("número que não é coordenada passa igual (hora do evento, memória, inteiros)", () => {
    const limpo = limparEvento({
      timestamp: 1730000000.1234,
      contexts: { device: { memory_size: 4096, screen_density: 2.625, battery_level: 87.5 } },
    });
    expect(limpo.timestamp).toBe(1730000000.1234);
    expect(limpo.contexts.device).toEqual({ memory_size: 4096, screen_density: 2.625, battery_level: 87.5 });
  });

  test("da requisição sobram só método e rota", () => {
    expect(limparEvento(evento()).request).toEqual({
      method: "POST",
      url: "https://api/visitas/checkin",
    });
  });

  test("apaga campos de posição, identificação da pessoa e do aparelho em qualquer nível", () => {
    const { extra } = limparEvento(evento());
    expect(extra.posicao).toBe("[removido]");
    expect(extra.latitude).toBe("[removido]");
    expect(extra.dispositivoId).toBe("[removido]");
    expect(extra.nome).toBe("[removido]");
    expect(extra.telefone).toBe("[removido]");
    expect(extra.tentativa).toBe(2);
  });

  test("limpa a mensagem e o texto da exceção, mas preserva a pilha", () => {
    const limpo = limparEvento(evento());
    expect(limpo.message).toBe("Falha no check-in de [email]");
    expect(limpo.exception.values[0].value).toBe("Posição [coord] recusada para [token]");
    expect(limpo.exception.values[0].stacktrace).toEqual(evento().exception.values[0].stacktrace);
  });

  test("mantém o que descreve o aparelho e a plataforma", () => {
    const limpo = limparEvento(evento());
    expect(limpo.platform).toBe("javascript");
    expect(limpo.contexts.device).toEqual({ model: "moto g54", family: "Android" });
  });

  test("objeto aninhado demais é cortado", () => {
    const { extra } = limparEvento(evento());
    expect(JSON.stringify(extra.profundo)).toContain("[removido]");
    expect(JSON.stringify(extra.profundo)).not.toContain("fundo");
  });

  test("apaga nome e telefone com os nomes de campo que o app usa (cadastro, perfil)", () => {
    const { extra } = limparEvento({
      extra: { usuario: { fullName: "Maria Souza", phone: "61999990000", celular: "61988880000", id: 7 } },
    });
    expect(extra.usuario).toEqual({ fullName: "[removido]", phone: "[removido]", celular: "[removido]", id: 7 });
  });

  test("query de URL guardada à parte (breadcrumb de rede) é apagada", () => {
    const { extra } = limparEvento({
      extra: { "http.query": "latitude=-15.92&longitude=-48.05", "http.fragment": "x", "http.method": "GET" },
    });
    expect(extra).toEqual({ "http.query": "[removido]", "http.fragment": "[removido]", "http.method": "GET" });
  });

  test("campo url que não é texto é limpo por dentro", () => {
    const { extra } = limparEvento({ extra: { url: { href: "https://api/x", token: "abc", lat: -23.5505 } } });
    expect(extra.url).toEqual({ href: "https://api/x", token: "[removido]", lat: "[removido]" });
  });

  test("campo url fora da requisição também perde a query string", () => {
    const limpo = limparEvento({ extra: { url: "https://api/hospitais?lat=-15.7942287" } });
    expect(limpo.extra.url).toBe("https://api/hospitais");
  });

  test("evento sem requisição não ganha uma", () => {
    expect(limparEvento({ message: "x" })).toEqual({ message: "x" });
  });

  test("evento vazio passa igual", () => {
    expect(limparEvento(null)).toBeNull();
  });
});

describe("limparBreadcrumb (beforeBreadcrumb)", () => {
  test("requisição HTTP fica só com método, rota e status", () => {
    const limpo = limparBreadcrumb({
      category: "fetch",
      type: "http",
      data: {
        method: "GET",
        url: "https://api/hospitais/proximos?lat=-15.7942287&lng=-47.8821658",
        status_code: 200,
        request_body_size: 120,
        response_body_size: 4096,
      },
    });
    expect(limpo.data).toEqual({
      method: "GET",
      url: "https://api/hospitais/proximos",
      status_code: 200,
    });
  });

  test("xhr sem dados não quebra", () => {
    expect(limparBreadcrumb({ category: "xhr" }).data).toEqual({
      method: undefined,
      url: undefined,
      status_code: undefined,
    });
  });

  test("mensagem de console passa pela limpeza de texto", () => {
    const limpo = limparBreadcrumb({
      category: "console",
      level: "warning",
      message: "GeofencingTaskService: posição -15.7942287 sem token Bearer abc",
    });
    expect(limpo.message).toBe("GeofencingTaskService: posição [coord] sem token Bearer [token]");
  });

  test("breadcrumb vazio passa igual", () => {
    expect(limparBreadcrumb(undefined)).toBeUndefined();
  });
});
