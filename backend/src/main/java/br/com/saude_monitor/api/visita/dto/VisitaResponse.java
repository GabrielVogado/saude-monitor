package br.com.saude_monitor.api.visita.dto;

import br.com.saude_monitor.api.visita.document.OrigemVisita;
import br.com.saude_monitor.api.visita.document.StatusVisita;
import br.com.saude_monitor.api.visita.document.TipoPermanencia;

import java.time.Instant;

/** Representação completa de uma visita, usada no card de visita ativa e no histórico (§3.3). */
public record VisitaResponse(
        String id,
        String usuarioId,
        String hospitalId,
        Instant entrada,
        Instant saida,
        Integer duracaoMinutos,
        StatusVisita status,
        TipoPermanencia tipoPermanencia,
        Instant ultimoHeartbeat,
        OrigemVisita origem,
        Instant criadoEm
) {
}
