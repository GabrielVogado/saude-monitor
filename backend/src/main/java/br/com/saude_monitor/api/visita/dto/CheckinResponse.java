package br.com.saude_monitor.api.visita.dto;

import br.com.saude_monitor.api.visita.document.StatusVisita;

import java.time.Instant;

/**
 * Resposta de check-in. {@code criado = true} indica visita nova (HTTP 201); {@code false}
 * indica retorno idempotente de visita ativa já existente no mesmo hospital (HTTP 200, RN-03/§3.3).
 */
public record CheckinResponse(
        String id,
        String hospitalId,
        Instant entrada,
        StatusVisita status,
        boolean criado
) {
}
