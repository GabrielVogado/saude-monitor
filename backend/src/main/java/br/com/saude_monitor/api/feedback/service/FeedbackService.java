package br.com.saude_monitor.api.feedback.service;

import br.com.saude_monitor.api.feedback.dto.FeedbackRequest;
import br.com.saude_monitor.api.feedback.dto.FeedbackResponse;
import br.com.saude_monitor.api.hospital.dto.PageResponse;

import java.util.Optional;

/**
 * Serviço de feedback pós-saída (Épico 03 / F-05). Responsabilidades: criar feedback
 * com dedupe (RN-12) e suporte anônimo (RN-13), consultar feedback de uma visita,
 * editar comentário/nota dentro da janela de 24h (RN-09) e prover o histórico do
 * titular (Épico 05/RN-22).
 */
public interface FeedbackService {

    FeedbackResponse criar(FeedbackRequest request, String usuarioId);

    Optional<FeedbackResponse> buscarPorVisita(String visitaId, String usuarioId);

    FeedbackResponse atualizar(String id, FeedbackRequest request, String usuarioId);

    /** Histórico paginado de feedbacks do usuário (E5-03/RN-22) — apenas os dele. */
    PageResponse<FeedbackResponse> historico(String usuarioId, int page, int size);

    /**
     * Job periódico (RN-09): marca {@code SEM_FEEDBACK} as visitas {@code FINALIZADA}
     * cuja janela de 24h para responder expirou sem feedback (1 único lembrete já emitido).
     */
    void processarSemResposta();
}
