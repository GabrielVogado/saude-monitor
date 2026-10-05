import { apiRequest as request } from "../../../core/api/apiClient";

const BASE_PATH = "/api/v1/feedbacks";

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
   *
   * `idempotente: true` porque o backend deduplica por `visitaId` (índice único +
   * `existsByVisitaId`): uma repetição em 502/503/504 — que tipicamente ocorre antes
   * de a aplicação processar qualquer coisa — no pior caso bate em 409 ("Você já
   * avaliou esta visita"), já tratado pela tela como sucesso, não como erro.
   */
  static enviar(payload) {
    return request(BASE_PATH, { method: "POST", body: payload, idempotente: true });
  }

  /** Feedback da visita (dono) — usado para pré-preencher a edição dentro da janela de 24h. */
  static buscarPorVisita(visitaId) {
    return request(`/api/v1/visitas/${visitaId}/feedback`);
  }

  /** Edita feedback dentro da janela de 24h (dono, RN-09). Mesma dedupe do `enviar` acima. */
  static atualizar(id, payload) {
    return request(`${BASE_PATH}/${id}`, { method: "PUT", body: payload, idempotente: true });
  }

  /**
   * Visitas do usuário logado que ainda aguardam feedback, dentro da janela de 24h
   * (RN-09): `[{ visitaId, hospitalId, hospitalNome, saida, prazo }]`.
   */
  static listarPendentes() {
    return request(`/api/v1/contas/feedbacks/pendentes`);
  }

  /** Histórico paginado de feedbacks do usuário (E5-03/RN-22 — namespace contas). */
  static listarHistorico({ page = 0, size = 20, signal } = {}) {
    return request(`/api/v1/contas/feedbacks?page=${page}&size=${size}`, { signal });
  }
}

export default FeedbackService;
