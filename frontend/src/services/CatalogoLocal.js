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
 * O catálogo é conferido com o servidor só quando a cópia passou da idade pedida, com
 * `If-None-Match`: se nada mudou, a resposta é 304 sem corpo. Sem rede, vale a cópia
 * guardada, por mais velha que esteja; a localização de um hospital quase nunca muda.
 */

const CHAVE = "@saude_monitor:catalogo";
const CAMINHO = "/api/v1/catalogo";

/** Idade da cópia aceita com o app aberto: o mesmo atraso dos dados públicos (P8). */
export const IDADE_MAXIMA_PRIMEIRO_PLANO_MS = 5 * 60 * 1000;

/** Idade aceita no recálculo em segundo plano: um dia, para o recálculo quase nunca usar rede. */
export const IDADE_MAXIMA_SEGUNDO_PLANO_MS = 24 * 60 * 60 * 1000;

const STATUS_NAO_MODIFICADO = 304;

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

async function conferir(guardado, agora) {
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
  static async estabelecimentos({ idadeMaximaMs = IDADE_MAXIMA_PRIMEIRO_PLANO_MS, agora = Date.now() } = {}) {
    const guardado = await lerGuardado();
    if (guardado && agora - (guardado.conferidoEm || 0) < idadeMaximaMs) {
      return guardado.estabelecimentos;
    }
    if (!conferenciaEmAndamento) {
      conferenciaEmAndamento = conferir(guardado, agora).finally(() => {
        conferenciaEmAndamento = null;
      });
    }
    try {
      return (await conferenciaEmAndamento).estabelecimentos;
    } catch (error_) {
      if (guardado) {
        return guardado.estabelecimentos;
      }
      throw error_;
    }
  }

  /** Apaga a cópia guardada (ex.: teste ou troca de ambiente). */
  static async limpar() {
    await AsyncStorage.removeItem(CHAVE);
  }
}

export default CatalogoLocal;
