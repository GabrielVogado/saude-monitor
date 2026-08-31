import { buildApiUrl } from "../../../config/api";
import TokenStorage from "../../../services/TokenStorage";
import LoginService from "../../auth/service/LoginService";

const BASE_PATH = "/api/v1/visitas";

/**
 * Cabeçalhos de autenticação (JWT). Anexa `Authorization: Bearer <accessToken>`
 * quando houver sessão ativa; vazio para chamadas anônimas (check-in/checkout/
 * heartbeat via `dispositivoId`, §3.3).
 */
async function authHeaders() {
  const token = await TokenStorage.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Cliente HTTP compartilhado, com tratamento de erro pt-BR, envelope de erro
 * padronizado (Especificacao-API-v2.0 §1.1) e renovação automática do token
 * (401 → refresh → retry único). Replica o padrão de `HospitalService.js`.
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
    const erro = new Error(message);
    // Anexa status HTTP e corpo bruto para tratamentos específicos (ex.: 409 de
    // conflito de geofence com `candidatos`, E2-04) sem quebrar quem só usa `.message`.
    erro.status = response.status;
    erro.data = data;
    throw erro;
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

class VisitaService {
  /**
   * Registra entrada (E2-01/E2-06). `origem` = "GEOFENCE" | "MANUAL".
   * `posicao` é obrigatória para GEOFENCE; `dispositivoId` permite visita anônima.
   * Em caso de empate de geofences (E2-04), o backend responde 409 com `candidatos`.
   */
  static checkin({ hospitalId, origem, posicao, dispositivoId }) {
    return request(`${BASE_PATH}/checkin`, {
      method: "POST",
      body: { hospitalId, origem, posicao, dispositivoId },
    });
  }

  /** Registra saída (E2-02/E2-05). `gpsIndisponivel` encerra como GPS_INTERROMPIDO. */
  static checkout(id, { posicao, gpsIndisponivel, encerramentoManual } = {}) {
    return request(`${BASE_PATH}/${id}/checkout`, {
      method: "POST",
      body: { posicao, gpsIndisponivel, encerramentoManual },
    });
  }

  /** Sinal de vida da visita ativa (E2-09); posição opcional renova o sinal de GPS (E2-05). */
  static heartbeat(id, posicao) {
    return request(`${BASE_PATH}/${id}/heartbeat`, {
      method: "POST",
      body: posicao ? { posicao } : {},
    });
  }

  /** Sinaliza observação/internação após 12h de visita ativa (E2-10). */
  static definirTipoPermanencia(id, tipoPermanencia) {
    return request(`${BASE_PATH}/${id}/tipo-permanencia`, {
      method: "PATCH",
      body: { tipoPermanencia },
    });
  }

  /** Visita ativa do usuário, para o card/cronômetro (E2-07). */
  static buscarAtiva() {
    return request(`${BASE_PATH}/ativas`);
  }

  /** Histórico paginado de visitas do usuário (E5-03 — namespace contas). */
  static listarHistorico({ page = 0, size = 20 } = {}) {
    return request(`/api/v1/contas/visitas${buildQuery({ page, size })}`);
  }
}

export default VisitaService;
