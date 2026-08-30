package br.com.saude_monitor.api.feedback.service;

import br.com.saude_monitor.api.feedback.dto.FeedbackRequest;
import br.com.saude_monitor.api.feedback.dto.FeedbackResponse;

import java.util.Optional;

/**
 * Serviço de feedback pós-saída (Épico 03 / F-05). Responsabilidades: criar feedback
 * com dedupe (RN-12) e suporte anônimo (RN-13), consultar feedback de uma visita e
 * editar comentário/nota dentro da janela de 24h (RN-09).
 */
public interface FeedbackService {

    FeedbackResponse criar(FeedbackRequest request, String usuarioId);

    Optional<FeedbackResponse> buscarPorVisita(String visitaId, String usuarioId);

    FeedbackResponse atualizar(String id, FeedbackRequest request, String usuarioId);

    /**
     * Job periódico (RN-09): marca {@code SEM_FEEDBACK} as visitas {@code FINALIZADA}
     * cuja janela de 24h para responder expirou sem feedback (1 único lembrete já emitido).
     */
    void processarSemResposta();
}
