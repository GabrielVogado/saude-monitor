package br.com.saude_monitor.api.feedback.dto;

import java.time.Instant;

/**
 * Visita do usuário que ainda aceita feedback ({@code GET /api/v1/contas/feedbacks/pendentes}).
 * {@code prazo} é o fim da janela de 24h a partir da saída (RN-09).
 */
public record FeedbackPendenteResponse(
        String visitaId,
        String hospitalId,
        String hospitalNome,
        Instant saida,
        Instant prazo
) {
}
