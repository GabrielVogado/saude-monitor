import * as Sentry from "@sentry/react-native";
import { NativeModules } from "react-native";

/**
 * Crash reporting do app (E8-07, OPS-03): cada erro não tratado chega ao Sentry com a
 * pilha de chamadas, a versão do app e o modelo/versão do Android, agrupado com os iguais.
 * Antes, o crash do PR #46 e o ANR do BUG-04 só foram descobertos porque alguém contou.
 *
 * Desligado sem DSN: `EXPO_PUBLIC_SENTRY_DSN` só existe no build do CI (secret), então o
 * desenvolvimento local e os testes seguem sem enviar nada.
 *
 * LGPD: localização em hospital é dado sensível (art. 11). Nada sai do aparelho sem passar
 * por `limparEvento`/`limparBreadcrumb`, que apagam coordenadas, e-mail, tokens e corpo de
 * requisição. Sem `sendDefaultPii`, sem captura de tela, sem replay e sem tracing. Os
 * crashes e ANRs nativos do Android não passam pelo `beforeSend` do JS: recebem a mesma
 * limpeza no `LimpezaSentry` (Kotlin), instalado assim que o SDK nativo liga.
 *
 * O `release` não é definido aqui de propósito: o SDK usa `<applicationId>@<versionName>+
 * <versionCode>`, o mesmo nome com que o `sentry.gradle` envia o mapa de código no build.
 */

const REMOVIDO = "[removido]";

// Chaves cujo valor nunca sai do aparelho, em qualquer nível do evento. Comparação exata
// (sem trecho), para não apagar campos como `platform` só por conterem "lat".
const CHAVES_SENSIVEIS = new Set(
  [
    "lat",
    "lng",
    "lon",
    "latitude",
    "longitude",
    "coords",
    "coordinates",
    "posicao",
    "localizacao",
    "email",
    "nome",
    "telefone",
    // Nomes dos campos de conta como o app e a API os usam (cadastro, perfil).
    "fullname",
    "phone",
    "celular",
    "senha",
    "password",
    "token",
    "accesstoken",
    "refreshtoken",
    "authorization",
    "cookie",
    "cookies",
    "x-cliente-id",
    "dispositivoid",
    // Query e fragmento de URL guardados à parte (breadcrumb de rede do SDK).
    "http.query",
    "http.fragment",
  ].map((chave) => chave.toLowerCase())
);

// Partes do evento que só descrevem código (arquivo, linha, módulo): não passam pela
// limpeza de texto, que só atrapalharia a leitura da pilha.
const CHAVES_DE_CODIGO = new Set(["stacktrace", "debug_meta", "sdk", "modules"]);

const PADROES_DE_TEXTO = [
  // JWT (access/refresh do backend, F0-01).
  [/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[token]"],
  [/Bearer\s+[\w.~+/=-]+/gi, "Bearer [token]"],
  // Linear: o lookbehind só deixa começar no início de uma palavra, e os rótulos do domínio
  // são separados por ponto sem sobreposição entre as classes (sem backtracking).
  [/(?<![\w.%+-])[\w.%+-]+@[\w-]+(?:\.[\w-]+)+/gi, "[email]"],
  // Coordenada em grau decimal com 4+ casas (~11 m): é a precisão que identifica o
  // hospital. Inteiros, versões ("1.0.0") e durações não casam.
  [/-?\b\d{1,3}\.\d{4,}\b/g, "[coord]"],
];

const PROFUNDIDADE_MAXIMA = 8;

/**
 * Coordenada guardada como número (`centro: [-46.6333, -23.5505]`, `console.warn(msg, lat)`):
 * mesmo critério do texto, 4+ casas decimais dentro da faixa de grau. Data e hora do evento
 * são segundos desde 1970 (bem acima de 180) e não casam.
 */
function pareceCoordenada(numero) {
  if (!Number.isFinite(numero) || Number.isInteger(numero) || Math.abs(numero) > 180) {
    return false;
  }
  const decimais = String(numero).split(".")[1] || "";
  return !decimais.includes("e") && decimais.length >= 4;
}

export function limparTexto(texto) {
  if (typeof texto !== "string") {
    return texto;
  }
  return PADROES_DE_TEXTO.reduce((atual, [padrao, troca]) => atual.replace(padrao, troca), texto);
}

/** Tira a query string: `/hospitais?lat=..&lng=..` levaria a posição do usuário junto. */
export function semQueryString(url) {
  if (typeof url !== "string") {
    return url;
  }
  const corte = url.search(/[?#]/);
  return corte === -1 ? url : url.slice(0, corte);
}

function limparValor(valor, profundidade) {
  if (typeof valor === "string") {
    return limparTexto(valor);
  }
  if (typeof valor === "number") {
    return pareceCoordenada(valor) ? "[coord]" : valor;
  }
  if (!valor || typeof valor !== "object") {
    return valor;
  }
  if (profundidade >= PROFUNDIDADE_MAXIMA) {
    return REMOVIDO;
  }
  if (Array.isArray(valor)) {
    return valor.map((item) => limparValor(item, profundidade + 1));
  }
  const limpo = {};
  for (const [chave, item] of Object.entries(valor)) {
    if (CHAVES_SENSIVEIS.has(chave.toLowerCase())) {
      limpo[chave] = REMOVIDO;
    } else if (CHAVES_DE_CODIGO.has(chave)) {
      limpo[chave] = item;
    } else if (chave === "url" && typeof item === "string") {
      limpo[chave] = limparTexto(semQueryString(item));
    } else {
      limpo[chave] = limparValor(item, profundidade + 1);
    }
  }
  return limpo;
}

/**
 * `beforeSend`: devolve uma cópia do evento sem dado pessoal. Do usuário fica só o `id`, o
 * código aleatório que o Sentry cria na instalação do app (é o que conta em quantos aparelhos
 * o erro aconteceu, como diz a política de privacidade); IP, e-mail e o resto saem. Sem
 * corpo/cabeçalho/cookie de requisição, e todo texto passa pelos padrões acima.
 */
export function limparEvento(evento) {
  if (!evento) {
    return evento;
  }
  const { request, user } = evento;
  const semUsuario = { ...evento };
  delete semUsuario.user;
  delete semUsuario.request;
  const limpo = limparValor(semUsuario, 0);
  if (user?.id) {
    limpo.user = { id: user.id };
  }
  if (request) {
    limpo.request = {
      method: request.method,
      url: limparTexto(semQueryString(request.url)),
    };
  }
  return limpo;
}

/**
 * `beforeBreadcrumb`: o rastro do que aconteceu antes do erro. Requisições HTTP ficam só com
 * método, rota sem query e status; o resto passa pela mesma limpeza do evento.
 */
export function limparBreadcrumb(breadcrumb) {
  if (!breadcrumb) {
    return breadcrumb;
  }
  if (breadcrumb.category === "fetch" || breadcrumb.category === "xhr") {
    const dados = breadcrumb.data || {};
    return {
      ...breadcrumb,
      data: {
        method: dados.method,
        url: limparTexto(semQueryString(dados.url)),
        status_code: dados.status_code,
      },
    };
  }
  return limparValor(breadcrumb, 0);
}

let ativo = false;

/**
 * Liga a limpeza do lado nativo (`LimpezaSentry.kt`). Só depois do `initNativeSdk`: o SDK
 * nativo é recriado ali e perderia o que fosse instalado antes. Sem o módulo (Jest, iOS), não
 * faz nada.
 */
function instalarLimpezaNativa({ didCallNativeInit }) {
  if (!didCallNativeInit) {
    return;
  }
  try {
    NativeModules.LimpezaSentry?.instalar();
  } catch {
    // Monitorar não pode derrubar o app.
  }
}

/**
 * Liga o Sentry quando há DSN. Chamado uma vez por `iniciarMonitoramento.js`, o primeiro
 * import do `index.js`, antes de qualquer outro módulo do app ser avaliado — também quando o
 * SO acorda o app fechado só para a tarefa de geofencing, que é justamente onde estão os
 * erros que ninguém vê.
 *
 * @returns {boolean} se o monitoramento ficou ligado.
 */
export function iniciarMonitoramento({
  dsn = process.env.EXPO_PUBLIC_SENTRY_DSN,
  ambiente = process.env.EXPO_PUBLIC_AMBIENTE,
} = {}) {
  if (ativo) {
    return true;
  }
  if (!dsn) {
    return false;
  }
  Sentry.init({
    dsn,
    environment: ambiente || "dev",
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    // Só erros: tracing e profiling gastam cota e mandam dados de navegação à toa.
    tracesSampleRate: 0,
    enableAutoPerformanceTracing: false,
    maxBreadcrumbs: 50,
    beforeSend: limparEvento,
    beforeBreadcrumb: limparBreadcrumb,
    onReady: instalarLimpezaNativa,
  });
  ativo = true;
  return true;
}

/** Envolve o componente raiz quando o monitoramento está ligado (erros de renderização). */
export function envolverRaiz(Componente) {
  return ativo ? Sentry.wrap(Componente) : Componente;
}

/**
 * Recusas do Android que o app já contorna (o timer e a próxima abertura confirmam a
 * pendência): o serviço em primeiro plano não pode nascer com o app em segundo plano
 * (Android 12+), e a permissão de localização pode ter sido revogada nas configurações.
 * `ERR_FOREGROUND_SERVICE_PERMISSIONS` (falta no manifesto) fica de fora: é defeito do app.
 */
const RECUSAS_DO_SISTEMA = new Set([
  "ERR_FOREGROUND_SERVICE_START_NOT_ALLOWED",
  "ERR_LOCATION_BACKGROUND_UNAUTHORIZED",
  "ERR_LOCATION_UNAUTHORIZED",
]);

/**
 * Falha de transporte (sem internet, timeout, servidor fora) é rotina num app de celular e
 * já tem tratamento (fila offline, nova tentativa). Resposta HTTP de erro também não vai: o
 * 5xx o próprio backend registra, o 401 é sessão vencida que o cliente HTTP trata, e os 4xx
 * são recusas de negócio esperadas — a posição fora do geofence (a região nativa é maior que
 * o polígono de propósito, BUG-08), hospital inativo, 403, 409, o 429 do limite.
 * A exceção é o 400 com `details`: campo reprovado pelo Bean Validation quer dizer que o app
 * montou o payload errado.
 * Mandar o resto esgotaria a cota sem dizer nada que o app possa corrigir.
 */
function ehErroEsperado(erro) {
  if (!erro) {
    return true;
  }
  if (erro.classificado || erro.enfileirado || RECUSAS_DO_SISTEMA.has(erro.code)) {
    return true;
  }
  if (typeof erro.status !== "number") {
    return false;
  }
  const payloadInvalido = erro.status === 400 && erro.data?.details?.length > 0;
  return !payloadInvalido;
}

/**
 * Registra um erro que o app tratou mas que ninguém veria: os `catch` das tarefas em
 * segundo plano (geofencing, sinal da visita, agendamento do feedback). `local` diz de
 * onde veio, para filtrar no painel. Nunca lança: monitorar não pode quebrar o fluxo.
 */
export function registrarErro(erro, local) {
  if (!ativo || ehErroEsperado(erro)) {
    return;
  }
  try {
    Sentry.captureException(erro, local ? { tags: { local } } : undefined);
  } catch {
    // O SDK indisponível não pode derrubar o geofencing.
  }
}

/** Só para testes: volta ao estado inicial (desligado). */
export function _reiniciarParaTeste() {
  ativo = false;
}
