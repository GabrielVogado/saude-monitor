import { buildApiUrl } from "../../../config/api";
import TokenStorage from "../../../services/TokenStorage";
import LoginService from "../../auth/service/LoginService";

const BASE_PATH = "/api/v1/hospitais";

/**
 * Cabeçalhos de autenticação (JWT). Anexa `Authorization: Bearer <accessToken>`
 * quando houver sessão ativa; vazio para chamadas públicas (listagem, detalhe,
 * geofence, sugestão).
 */
async function authHeaders() {
  const token = await TokenStorage.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Cliente HTTP compartilhado, com tratamento de erro pt-BR, envelope de erro
 * padronizado (Especificacao-API-v2.0 §1.1) e renovação automática do token
 * (401 → refresh → retry único).
 */
async function request(path, { method = "GET", body, headers = {} } = {}) {
  const doFetch = async () => {
    const url = buildApiUrl(path);
    const config = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
        ...headers,
      },
    };

    if (body !== undefined) {
      config.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(url, config);
    } catch (error) {
      if (error?.message === "Network request failed") {
        throw new Error(
          `Não foi possível conectar ao backend em ${url}. Verifique a API, a URL e a rede.`
        );
      }
      throw error;
    }

    return response;
  };

  let response = await doFetch();

  // Renovação automática do access token quando expirado (HTTP 401).
  // Só tenta renovar se houver refresh token persistido (sessão ativa).
  if (response.status === 401) {
    const refreshToken = await TokenStorage.getRefreshToken();
    if (refreshToken) {
      try {
        await LoginService.refresh();
        response = await doFetch();
      } catch {
        await LoginService.logout();
        throw new Error("Sessão expirada. Faça login novamente.");
      }
    }
  }

  const raw = await response.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Falha na requisição (HTTP ${response.status}).`;
    throw new Error(message);
  }

  return data;
}

function buildQuery(params = {}) {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  return query ? `?${query}` : "";
}

class HospitalService {
  /**
   * Lista hospitais ativos (E1-03).
   * Query opcional: latitude, longitude, raioKm, tipo, busca, page, size.
   *
   * A busca por nome é insensível a acentos/caixa (normalizada no backend e,
   * defensivamente, na tela de listagem).
   */
  static listar({ latitude, longitude, raioKm, tipo, busca, page = 0, size = 20 } = {}) {
    return request(`${BASE_PATH}${buildQuery({ latitude, longitude, raioKm, tipo, busca, page, size })}`);
  }

  /**
   * Ranking público de hospitais (E4-05).
   *
   * `ordem` aceita `NOTA` (maior nota primeiro) ou `TEMPO` (menor tempo mediano
   * primeiro); `tipo` filtra por natureza do estabelecimento. Hospitais sem amostra
   * suficiente (RN-15) vêm com `indicadores.indicadoresDisponiveis = false` e são
   * posicionados ao final pelo backend.
   */
  static ranking({ ordem = "NOTA", tipo, page = 0, size = 20 } = {}) {
    return request(`${BASE_PATH}/ranking${buildQuery({ ordem, tipo, page, size })}`);
  }

  /**
   * Detalhe público do hospital (campos + indicadores embutidos).
   *
   * Campos esperados no JSON: `nome`, `tipo` (natureza), `categoria`
   * (HOSPITAL|UPA|UBS|OUTRO), `tipoUnidade` (ex.: "HOSPITAL GERAL"),
   * `horarioFuncionamento` (texto livre), `endereco`, `contato`, `geofence`,
   * `ativo`, `indicadores`.
   *
   * `tipoUnidade` e `horarioFuncionamento` são opcionais (o backend passa a
   * fornecê-los); consumidores devem tratar ausência com fallback elegante.
   */
  static buscarPorId(id) {
    return request(`${BASE_PATH}/${id}`);
  }

  /** Retorna apenas o geofence (renderização no mapa). */
  static buscarGeofence(id) {
    return request(`${BASE_PATH}/${id}/geofence`);
  }

  /**
   * Indicadores públicos enriquecidos do hospital (§3.5 / E4-01..E4-04).
   *
   * Campos: `hospitalId`, `indicadoresDisponiveis`, `notaMedia`, `nAvaliacoes`,
   * `tempoMedianoMinutos`, `nVisitas`, `periodo.{inicio,fim}`, `atualizadoEm`.
   * Quando `nAvaliacoes < 5`, `indicadoresDisponiveis = false` e `notaMedia`/
   * `tempoMedianoMinutos` são `null` (RN-15).
   */
  static buscarIndicadores(id) {
    return request(`${BASE_PATH}/${id}/indicadores`);
  }

  /**
   * Cadastro, atualização e ativação/desativação de hospital (E1-01/E1-02/E1-04)
   * são operações administrativas — migradas para o Painel Administrativo Web
   * (F-11). Este cliente mobile expõe apenas as operações públicas abaixo.
   */

  /** Sugestão pública de hospital ainda não cadastrado (E1-05, P2). */
  static sugerir(payload) {
    return request(`${BASE_PATH}/sugestoes`, { method: "POST", body: payload });
  }

  /**
   * Lista sugestões públicas de hospitais, filtráveis por status (E1-06).
   * Requer papel ADMIN.
   */
  static listarSugestoes({ status, page = 0, size = 20 } = {}) {
    return request(`${BASE_PATH}/sugestoes${buildQuery({ status, page, size })}`);
  }

  /** Busca sugestão pública por id (E1-06). Requer papel ADMIN. */
  static buscarSugestaoPorId(id) {
    return request(`${BASE_PATH}/sugestoes/${id}`);
  }

  /** Aprova uma sugestão pendente, vinculando-a a um hospital oficial (E1-06). Requer papel ADMIN. */
  static aprovarSugestao(id, hospitalId) {
    return request(`${BASE_PATH}/sugestoes/${id}/aprovar`, {
      method: "POST",
      body: { hospitalId },
    });
  }

  /** Rejeita uma sugestão pendente, exigindo motivo (E1-06). Requer papel ADMIN. */
  static rejeitarSugestao(id, motivo) {
    return request(`${BASE_PATH}/sugestoes/${id}/rejeitar`, {
      method: "POST",
      body: { motivo },
    });
  }
}

export default HospitalService;
