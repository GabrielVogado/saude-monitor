import * as Network from "expo-network";

/**
 * Cliente HTTP com timeout explícito e classificação de falha de rede (E8-04).
 *
 * O `fetch` do React Native não tem timeout: uma requisição que não responde
 * fica pendurada até o sistema desistir, e a tela permanece em carregamento sem
 * dizer nada ao usuário. Medido em 02/09/2026 contra o ambiente de destino, o
 * backend respondia entre 1,9 s e 4,9 s com o serviço quente e levou 119 s na
 * primeira abertura após ociosidade — exatamente o intervalo em que a ausência
 * de timeout vira "o aplicativo travou".
 *
 * Além do teto de tempo, o critério de aceite do E8-04 exige que a mensagem
 * distinga "sem internet" de "servidor indisponível". O `fetch` não permite
 * essa distinção sozinho: as duas situações chegam como o mesmo
 * `Network request failed`. Por isso, ao falhar, consultamos o estado de rede
 * do dispositivo (`expo-network`) antes de escolher a mensagem.
 */

/**
 * Teto padrão por requisição. Escolhido acima do pior caso observado com o
 * serviço quente (4,9 s) e com folga para rede móvel ruim, mas curto o bastante
 * para que a tela possa oferecer uma nova tentativa antes de o usuário desistir.
 */
export const TIMEOUT_PADRAO_MS = 20000;

/**
 * Base das falhas de conexão já classificadas. Os serviços usam o marcador
 * `classificado` para repassar o erro intacto, em vez de sobrescrevê-lo com a
 * mensagem genérica de rede e apagar a distinção feita aqui.
 */
export class ErroDeConexao extends Error {
  constructor(mensagem, url) {
    super(mensagem);
    this.classificado = true;
    this.url = url;
  }
}

/** O servidor foi alcançado (ou pode ter sido), mas não respondeu a tempo. */
export class ErroDeTimeout extends ErroDeConexao {
  constructor(url, timeoutMs) {
    super(
      `O servidor demorou mais de ${Math.round(
        timeoutMs / 1000
      )} segundos para responder. Tente novamente em instantes.`,
      url
    );
    this.name = "ErroDeTimeout";
    this.timeoutMs = timeoutMs;
  }
}

/** O dispositivo está sem internet: a requisição nem chegou a sair. */
export class ErroSemInternet extends ErroDeConexao {
  constructor(url) {
    super(
      "Sem conexão com a internet. Verifique o Wi-Fi ou os dados móveis e tente novamente.",
      url
    );
    this.name = "ErroSemInternet";
  }
}

/**
 * Sem internet, mas o evento não se perdeu: ficou na fila offline (OPS-05) e sai
 * assim que a conexão voltar. É subclasse de `ErroSemInternet` de propósito —
 * quem já tratava a falta de conexão continua tratando, apenas com uma mensagem
 * que promete o que a fila cumpre.
 */
export class ErroEnfileirado extends ErroSemInternet {
  constructor(url, mensagem) {
    super(url);
    this.message =
      mensagem ||
      "Sem conexão com a internet. O registro foi guardado e será enviado assim que a conexão voltar.";
    this.name = "ErroEnfileirado";
    this.enfileirado = true;
  }
}

/** Há internet, mas o servidor não aceitou a conexão. */
export class ErroServidorIndisponivel extends ErroDeConexao {
  constructor(url) {
    super(
      "O servidor está indisponível no momento. Ele pode estar reiniciando — tente novamente em instantes.",
      url
    );
    this.name = "ErroServidorIndisponivel";
  }
}

/**
 * Reconhece a falha de transporte do `fetch`. A mensagem muda por plataforma
 * (`Network request failed` no React Native, `Failed to fetch` nos navegadores
 * baseados em Chromium, `NetworkError ...` no Firefox).
 */
export function ehFalhaDeRede(erro) {
  const mensagem = erro?.message || "";

  return (
    erro instanceof TypeError ||
    /network request failed|failed to fetch|network ?error/i.test(mensagem)
  );
}

/**
 * Responde se o dispositivo está sem internet.
 *
 * Retorna `null` quando não há como saber — nesse caso a falha é tratada como
 * servidor indisponível, porque a conectividade não chegou a ser negada.
 */
export async function dispositivoSemInternet() {
  try {
    const estado = await Network.getNetworkStateAsync();

    // `isInternetReachable` é o sinal mais forte: cobre o caso de estar
    // conectado a um Wi-Fi que não tem saída para a internet.
    if (typeof estado?.isInternetReachable === "boolean") {
      return !estado.isInternetReachable;
    }

    if (typeof estado?.isConnected === "boolean") {
      return !estado.isConnected;
    }
  } catch {
    // Módulo indisponível (ambiente de teste, web sem suporte): cai no
    // `navigator.onLine` abaixo.
  }

  const online = globalThis.navigator?.onLine;

  return typeof online === "boolean" ? !online : null;
}

/** Traduz uma falha de transporte no erro específico da causa provável. */
export async function classificarErroDeRede(erro, url) {
  if (erro?.classificado) {
    return erro;
  }

  if (!ehFalhaDeRede(erro)) {
    return erro;
  }

  return (await dispositivoSemInternet())
    ? new ErroSemInternet(url)
    : new ErroServidorIndisponivel(url);
}

/**
 * `fetch` com cancelamento automático por tempo.
 *
 * Preserva um `signal` que a chamadora já tenha passado: se a tela cancelar a
 * requisição (ao desmontar, por exemplo), o cancelamento continua funcionando e
 * é propagado como `AbortError`, distinto de `ErroDeTimeout`.
 */
export async function fetchComTimeout(url, config = {}, timeoutMs = TIMEOUT_PADRAO_MS) {
  const controlador = new AbortController();
  const estourou = { valor: false };

  const temporizador = setTimeout(() => {
    estourou.valor = true;
    controlador.abort();
  }, timeoutMs);

  const sinalExterno = config.signal;
  const abortarPorFora = () => controlador.abort();
  if (sinalExterno) {
    if (sinalExterno.aborted) {
      abortarPorFora();
    } else {
      sinalExterno.addEventListener?.("abort", abortarPorFora);
    }
  }

  try {
    return await fetch(url, { ...config, signal: controlador.signal });
  } catch (erro) {
    if (estourou.valor) {
      throw new ErroDeTimeout(url, timeoutMs);
    }

    throw await classificarErroDeRede(erro, url);
  } finally {
    clearTimeout(temporizador);
    sinalExterno?.removeEventListener?.("abort", abortarPorFora);
  }
}

/**
 * ---------------------------------------------------------------------------
 * Retry com backoff exponencial (OPS-05)
 * ---------------------------------------------------------------------------
 *
 * O timeout do E8-04 fez a tela parar de travar, mas o resultado continuava
 * sendo um erro na cara do usuário. Boa parte das falhas contra este backend é
 * transitória por natureza: instância hibernada acordando, reinício de deploy,
 * queda momentânea de sinal. Repetir a mesma requisição alguns segundos depois
 * resolve sem que o usuário precise saber que algo falhou.
 *
 * O backoff é exponencial com *jitter* porque a falha é correlacionada entre
 * dispositivos: quando o servidor volta de uma hibernação, todos os aparelhos
 * que falharam voltam a tentar. Repetir em intervalo fixo faria todos baterem
 * no mesmo instante e derrubariam de novo o serviço que acabou de subir.
 */

/** Tentativas totais (a primeira mais duas repetições) para falha barata. */
export const TENTATIVAS_PADRAO = 3;

/**
 * Repetições permitidas depois de um timeout. Uma recusa de conexão falha em
 * milissegundos e repetir é barato; um timeout custa 20 s por tentativa, e três
 * deles somam um minuto de espera — mais do que qualquer usuário aguarda. Por
 * isso o timeout corta o orçamento de tentativas para uma só.
 */
export const TENTATIVAS_APOS_TIMEOUT = 1;

export const BACKOFF_BASE_MS = 500;
export const BACKOFF_TETO_MS = 5000;

/** Métodos seguros de repetir sem combinar nada com o servidor. */
const METODOS_IDEMPOTENTES = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Status que indicam indisponibilidade temporária do servidor ou do proxy à
 * frente dele. O 429 fica de fora de propósito: repetir uma requisição barrada
 * por limite de taxa apenas consome a cota de novo, e a janela do limitador é
 * longa demais para caber num backoff de segundos.
 */
const STATUS_RETENTAVEIS = new Set([502, 503, 504]);

export function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Atraso da n-ésima repetição: exponencial limitado pelo teto, multiplicado por
 * um fator aleatório entre 0,5 e 1 (*jitter*) para espalhar no tempo as
 * tentativas de dispositivos diferentes.
 */
export function atrasoDoBackoff(tentativa, baseMs = BACKOFF_BASE_MS, aleatorio = Math.random) {
  const exponencial = Math.min(baseMs * 2 ** Math.max(0, tentativa - 1), BACKOFF_TETO_MS);

  return Math.round(exponencial * (0.5 + aleatorio() * 0.5));
}

/**
 * Respeita o `Retry-After` quando o servidor diz em quantos segundos volta.
 * Valores fora do razoável (ausente, não numérico ou acima do teto) caem no
 * backoff calculado — a espera é do usuário, não do servidor.
 */
function atrasoDaResposta(resposta, tentativa, baseMs) {
  const cabecalho = resposta?.headers?.get?.("Retry-After");
  const segundos = Number(cabecalho);

  if (Number.isFinite(segundos) && segundos > 0 && segundos * 1000 <= BACKOFF_TETO_MS) {
    return segundos * 1000;
  }

  return atrasoDoBackoff(tentativa, baseMs);
}

/**
 * `fetchComTimeout` que repete a requisição enquanto a falha parecer passageira.
 *
 * Só repete o que é seguro repetir. Por padrão isso significa métodos
 * idempotentes; chamadas que sabem ser seguras por outro motivo declaram
 * `idempotente: true` — é o caso do check-in e do checkout de visita, que o
 * servidor trata por identidade da visita ativa (§3.3/RN-03) e não duplicam
 * registro quando chegam duas vezes.
 *
 * Não repete quando o aparelho está sem internet: nesse caso não há o que
 * esperar do servidor, e o evento vai para a fila offline (`filaOffline.js`).
 */
export async function fetchComRetry(url, config = {}, opcoes = {}) {
  const {
    timeoutMs = TIMEOUT_PADRAO_MS,
    tentativas = TENTATIVAS_PADRAO,
    backoffBaseMs = BACKOFF_BASE_MS,
    idempotente = METODOS_IDEMPOTENTES.has((config.method || "GET").toUpperCase()),
  } = opcoes;

  let restantes = idempotente ? Math.max(1, tentativas) : 1;
  let tentativa = 0;

  for (;;) {
    tentativa += 1;
    restantes -= 1;

    try {
      const resposta = await fetchComTimeout(url, config, timeoutMs);

      if (restantes > 0 && STATUS_RETENTAVEIS.has(resposta.status)) {
        await esperar(atrasoDaResposta(resposta, tentativa, backoffBaseMs));
        continue;
      }

      return resposta;
    } catch (erro) {
      const passageiro = erro instanceof ErroDeConexao && !(erro instanceof ErroSemInternet);

      if (!passageiro || restantes <= 0) {
        throw erro;
      }

      if (erro instanceof ErroDeTimeout) {
        restantes = Math.min(restantes, TENTATIVAS_APOS_TIMEOUT);
      }

      await esperar(atrasoDoBackoff(tentativa, backoffBaseMs));
    }
  }
}
