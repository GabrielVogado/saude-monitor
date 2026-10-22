import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "../core/api/apiClient";

/**
 * Catálogo de estabelecimentos guardado no aparelho (APP-01, ARQ-01).
 *
 * O recálculo das regiões do geofencing (ao sair da região de recálculo, com o app
 * fechado) pedia ao servidor os hospitais num raio de 5 km da posição exata, a cada
 * deslocamento: na meta de uso do DF, era a maior fonte de requisições da API e nada dela
 * podia ser cacheado. Com o catálogo inteiro no aparelho (~340 estabelecimentos), a conta
 * de quais hospitais monitorar é feita aqui, sem rede.
 *
 * O catálogo só tem o que o painel muda (nome, endereço, posição, raio, tipo), sem nota nem
 * tempo. O app sabe que ele mudou pelo `versaoCatalogo` da configuração remota, lida ao
 * abrir e ao voltar ao primeiro plano (`sincronizarVersao`): só então baixa o catálogo de
 * novo. A idade máxima da cópia é uma rede de segurança de um dia para quando a
 * configuração não chega. A conferência vai com `If-None-Match`: se nada mudou, a resposta
 * é 304 sem corpo. Sem rede, vale a cópia guardada, por mais velha que esteja; a
 * localização de um hospital quase nunca muda.
 */

const CHAVE = "@saude_monitor:catalogo";
const CAMINHO = "/api/v1/catalogo";

/**
 * Idade da cópia aceita com o app aberto. Um dia: quem avisa que o catálogo mudou é a
 * versão da configuração remota, e esta idade só cobre a configuração que não chegou.
 */
export const IDADE_MAXIMA_PRIMEIRO_PLANO_MS = 24 * 60 * 60 * 1000;

/** Idade aceita no recálculo em segundo plano: um dia, para o recálculo quase nunca usar rede. */
export const IDADE_MAXIMA_SEGUNDO_PLANO_MS = 24 * 60 * 60 * 1000;

const STATUS_NAO_MODIFICADO = 304;

/**
 * Intervalo mínimo entre duas gravações de "conferida agora" quando a versão não mudou. A
 * configuração é lida a cada volta ao primeiro plano, e regravar o catálogo inteiro a cada
 * vez seria escrita à toa.
 */
export const INTERVALO_MINIMO_GRAVACAO_MS = 60 * 60 * 1000;

async function lerGuardado() {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE);
    const lido = bruto ? JSON.parse(bruto) : null;
    return Array.isArray(lido?.estabelecimentos) ? lido : null;
  } catch {
    return null;
  }
}

async function guardar(catalogo) {
  try {
    await AsyncStorage.setItem(CHAVE, JSON.stringify(catalogo));
  } catch {
    // Sem espaço: a cópia em memória desta chamada ainda serve, e a próxima tenta de novo.
  }
}

async function conferirComServidor(guardado, agora) {
  const headers = guardado?.versao ? { "If-None-Match": `W/"${guardado.versao}"` } : {};
  let resposta;
  try {
    resposta = await apiRequest(CAMINHO, { headers });
  } catch (error_) {
    if (guardado && error_?.status === STATUS_NAO_MODIFICADO) {
      const conferido = { ...guardado, conferidoEm: agora };
      await guardar(conferido);
      return conferido;
    }
    throw error_;
  }
  if (!Array.isArray(resposta?.estabelecimentos)) {
    // Algumas pilhas HTTP devolvem o 304 como resposta vazia; a cópia continua valendo.
    if (guardado) {
      const conferido = { ...guardado, conferidoEm: agora };
      await guardar(conferido);
      return conferido;
    }
    throw new Error("Catálogo sem estabelecimentos.");
  }
  const novo = { versao: resposta.versao, estabelecimentos: resposta.estabelecimentos, conferidoEm: agora };
  await guardar(novo);
  return novo;
}

/** Conferências em andamento, para chamadas simultâneas fazerem uma requisição só. */
let conferenciaEmAndamento = null;

function conferirUmaVez(guardado, agora) {
  if (!conferenciaEmAndamento) {
    conferenciaEmAndamento = conferirComServidor(guardado, agora).finally(() => {
      conferenciaEmAndamento = null;
    });
  }
  return conferenciaEmAndamento;
}

class CatalogoLocal {
  /**
   * Estabelecimentos ativos, com `id`, `localizacao` e `raioMetros` (mesmo formato da
   * listagem de hospitais).
   *
   * @param {object} [opcoes]
   * @param {number} [opcoes.idadeMaximaMs] idade da cópia guardada aceita sem conferir.
   * @param {number} [opcoes.agora] instante atual em ms (para teste).
   * @returns {Promise<object[]>}
   * @throws quando não há cópia guardada e o servidor não respondeu.
   */
  static async obterEstabelecimentos({ idadeMaximaMs = IDADE_MAXIMA_PRIMEIRO_PLANO_MS, agora = Date.now() } = {}) {
    const guardado = await lerGuardado();
    if (guardado && agora - (guardado.conferidoEm || 0) < idadeMaximaMs) {
      return guardado.estabelecimentos;
    }
    try {
      return (await conferirUmaVez(guardado, agora)).estabelecimentos;
    } catch (error_) {
      if (guardado) {
        return guardado.estabelecimentos;
      }
      throw error_;
    }
  }

  /**
   * Confere a cópia guardada com a versão do catálogo que a configuração remota informou.
   * Mesma versão: nada vai para a rede, e a cópia conta como conferida agora. Versão
   * diferente (ou nenhuma cópia): baixa o catálogo.
   *
   * @param {string|null|undefined} versao `versaoCatalogo` da configuração remota.
   * @param {object} [opcoes]
   * @param {number} [opcoes.agora] instante atual em ms (para teste).
   * @returns {Promise<boolean>} `true` quando a cópia guardada foi trocada por outra versão.
   *   Sem versão ou com falha de rede, `false`: a cópia que existe continua valendo.
   */
  static async sincronizarVersao(versao, { agora = Date.now() } = {}) {
    if (!versao) {
      return false;
    }
    const guardado = await lerGuardado();
    if (guardado?.versao === versao) {
      if (agora - (guardado.conferidoEm || 0) >= INTERVALO_MINIMO_GRAVACAO_MS) {
        await guardar({ ...guardado, conferidoEm: agora });
      }
      return false;
    }
    try {
      const atual = await conferirUmaVez(guardado, agora);
      return atual.versao !== guardado?.versao;
    } catch {
      return false;
    }
  }

  /**
   * Confere com o servidor só se a cópia guardada passou da idade máxima, sem esperar por
   * ninguém: é o caso da configuração remota que não chegou por um dia.
   *
   * @param {object} [opcoes]
   * @param {number} [opcoes.agora] instante atual em ms (para teste).
   * @returns {Promise<boolean>} `true` quando a cópia foi trocada por outra versão. Cópia
   *   ainda válida, sem cópia ou com falha de rede, `false`.
   */
  static async conferirSeVencida({ agora = Date.now() } = {}) {
    const guardado = await lerGuardado();
    if (!guardado || agora - (guardado.conferidoEm || 0) < IDADE_MAXIMA_PRIMEIRO_PLANO_MS) {
      return false;
    }
    try {
      const atual = await conferirUmaVez(guardado, agora);
      return atual.versao !== guardado.versao;
    } catch {
      return false;
    }
  }

  /**
   * Estabelecimentos da cópia guardada, sem rede nenhuma, ou `null` se não há cópia.
   * Para a tela mostrar algo na hora enquanto o servidor responde (teste de campo da
   * rc.6, 21/10/2026: com o backend frio, a lista demorava a aparecer).
   *
   * @returns {Promise<object[]|null>}
   */
  static async lerCopiaGuardada() {
    const guardado = await lerGuardado();
    return guardado ? guardado.estabelecimentos : null;
  }

  /** Apaga a cópia guardada (ex.: teste ou troca de ambiente). */
  static async limpar() {
    await AsyncStorage.removeItem(CHAVE);
  }
}

export default CatalogoLocal;
