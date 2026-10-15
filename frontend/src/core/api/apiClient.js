import { buildApiUrl } from "../../config/api";
import { classificarErroDeRede, fetchComRetry } from "../../config/http";
import { deveEncerrarSessao, geracaoDaSessao, renovarSessao } from "../../config/sessao";
import TokenStorage from "../../services/TokenStorage";
import { ApiError } from "./apiError";

/**
 * Cliente HTTP único dos serviços autenticados (auditoria técnica v4, §4.1).
 *
 * Até aqui, `HospitalService`, `VisitaService`, `FeedbackService` e `PerfilService`
 * tinham cada um a sua cópia de `request()`, com contratos de erro diferentes, e o
 * `LoginService.excluirConta()` tinha uma quinta versão que não renovava o token.
 * Este módulo concentra o que as cópias faziam: cabeçalho `Authorization`, timeout e
 * retry (`fetchComRetry`, OPS-05/E8-04), renovação do access token em 401 com uma só
 * renovação por geração (`config/sessao.js`) e o erro padronizado (`ApiError`).
 *
 * **Sem import do `LoginService`.** Quem renova e quem encerra a sessão é injetado
 * por `configurarSessao` (ver `core/api/sessaoApi.js`, carregado no `index.js`). Antes,
 * cada serviço importava o `LoginService` para o interceptor 401, e o `LoginService`
 * importava o `GeofencingTaskService`, que importa `HospitalService` e `VisitaService`:
 * um ciclo de import que só funcionava porque ninguém lia o binding no topo do módulo.
 */

const MENSAGEM_SESSAO_EXPIRADA = "Sessão expirada. Faça login novamente.";

/** Funções do ciclo de sessão, registradas no carregamento do app. */
const sessao = { renovar: null, encerrar: null };

/**
 * Registra quem renova o access token e quem encerra a sessão local.
 *
 * @param {{ renovar: () => Promise<unknown>, encerrar: () => Promise<void> }} funcoes
 */
export function configurarSessao({ renovar, encerrar } = {}) {
  sessao.renovar = renovar || null;
  sessao.encerrar = encerrar || null;
}

/**
 * Renova a sessão depois de um 401 e decide o que fazer se a renovação falhar.
 *
 * Só encerra a sessão quando o servidor rejeitou o refresh token (401/403): falha de
 * rede ou servidor indisponível (ex.: cold start) preserva a sessão local, porque o
 * refresh token (30 dias) segue bom para a próxima tentativa (achado de 10/09/2026).
 *
 * Exportada para o download do PDF de exportação LGPD, que é binário e não passa por
 * `apiRequest`, mas precisa do mesmo tratamento.
 *
 * @param {number} geracao geração da sessão lida antes da requisição que tomou 401.
 * @throws {ApiError} 401 quando a sessão foi encerrada.
 */
export async function renovarSessaoAposNaoAutorizado(geracao) {
  if (!sessao.renovar) {
    throw new ApiError(MENSAGEM_SESSAO_EXPIRADA, 401);
  }

  try {
    await renovarSessao(sessao.renovar, geracao);
  } catch (erroRenovacao) {
    if (deveEncerrarSessao(erroRenovacao)) {
      await sessao.encerrar?.();
      throw new ApiError(MENSAGEM_SESSAO_EXPIRADA, 401);
    }
    throw erroRenovacao;
  }
}

async function authHeaders() {
  const token = await TokenStorage.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function lerCorpo(response) {
  const raw = await response.text();
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Executa uma chamada JSON contra a API.
 *
 * @param {string} path caminho a partir da raiz da API (ex.: `/api/v1/hospitais`).
 * @param {object} [opcoes]
 * @param {string} [opcoes.method="GET"]
 * @param {unknown} [opcoes.body] objeto serializado em JSON (string passa intacta).
 * @param {object} [opcoes.headers] cabeçalhos extras.
 * @param {AbortSignal} [opcoes.signal] cancela a requisição (ex.: tela desmontada).
 * @param {boolean} [opcoes.idempotente] permite o retry de um método não idempotente
 *   que o servidor deduplica (ver `fetchComRetry`).
 * @returns {Promise<any>} corpo da resposta, ou `null` quando vazio.
 * @throws {ApiError} resposta fora de 2xx.
 * @throws {ErroDeConexao} falha de transporte já classificada.
 */
export async function apiRequest(path, { method = "GET", body, headers = {}, signal, idempotente } = {}) {
  const url = buildApiUrl(path);

  const doFetch = async () => {
    const config = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
        ...headers,
      },
    };

    if (signal) {
      config.signal = signal;
    }

    if (body !== undefined) {
      config.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    try {
      return await fetchComRetry(url, config, { idempotente });
    } catch (error) {
      throw await classificarErroDeRede(error, url);
    }
  };

  // Geração lida antes do 401: se ela mudar, outra requisição já renovou a
  // sessão e esta só precisa repetir a chamada com o token novo.
  const geracao = geracaoDaSessao();
  let response = await doFetch();

  // Só tenta renovar quando há refresh token persistido (sessão ativa): sem ele,
  // o 401 é a resposta de verdade e segue como erro.
  if (response.status === 401 && (await TokenStorage.getRefreshToken())) {
    await renovarSessaoAposNaoAutorizado(geracao);
    response = await doFetch();
  }

  const data = await lerCorpo(response);

  if (!response.ok) {
    const message = data?.message || data?.error || `Falha na requisição (HTTP ${response.status}).`;
    throw new ApiError(message, response.status, data);
  }

  return data;
}

/** Monta a query string, omitindo parâmetros vazios. */
export function buildQuery(params = {}) {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  return query ? `?${query}` : "";
}
