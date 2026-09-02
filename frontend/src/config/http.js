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
