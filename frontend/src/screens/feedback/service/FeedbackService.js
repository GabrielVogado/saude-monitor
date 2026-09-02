import { buildApiUrl } from "../../../config/api";
import { classificarErroDeRede, fetchComTimeout } from "../../../config/http";
import TokenStorage from "../../../services/TokenStorage";
import LoginService from "../../auth/service/LoginService";

const BASE_PATH = "/api/v1/feedbacks";

/**
 * Cabeçalhos de autenticação (JWT). O envio de feedback (POST) é público (RN-20):
 * quando há sessão ativa anexa o token para vincular o feedback ao usuário (RN-13);
 * anônimo envia sem token e o backend marca `anonimizado = true`.
 */
async function authHeaders() {
  const token = await TokenStorage.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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
      response = await fetchComTimeout(url, config);
    } catch (error) {
      throw await classificarErroDeRede(error, url);
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
      data?.message || data?.error || `Falha na requisição (HTTP ${response.status}).`;
    const erro = new Error(message);
    erro.status = response.status;
    erro.data = data;
    throw erro;
  }

  return data;
}

/**
 * Client da API de feedback pós-saída (Épico 03 — §3.4).
 *
 * Legenda de segurança: POST é público/anônimo (RN-20); GET/PUT exigem autenticação
 * do dono (RN-22) e a API de feedback nunca expõe quem avaliou (RN-17/RN-19).
 */
class FeedbackService {
  /**
   * Envia o feedback (E3-02). Devolve `{ id, criadoEm, recebido }` (201).
   * Vários campos são opcionais/puláveis (RN-11); `nota` (1–5) é obrigatória.
   */
  static enviar(payload) {
    return request(BASE_PATH, { method: "POST", body: payload });
  }

  /** Feedback da visita (dono) — usado para pré-preencher a edição dentro da janela de 24h. */
  static buscarPorVisita(visitaId) {
    return request(`/api/v1/visitas/${visitaId}/feedback`);
  }

  /** Edita feedback dentro da janela de 24h (dono, RN-09). */
  static atualizar(id, payload) {
    return request(`${BASE_PATH}/${id}`, { method: "PUT", body: payload });
  }

  /** Histórico paginado de feedbacks do usuário (E5-03/RN-22 — namespace contas). */
  static listarHistorico({ page = 0, size = 20 } = {}) {
    return request(`/api/v1/contas/feedbacks?page=${page}&size=${size}`);
  }
}

export default FeedbackService;
