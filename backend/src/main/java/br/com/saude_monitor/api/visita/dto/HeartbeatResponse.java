package br.com.saude_monitor.api.visita.dto;

import br.com.saude_monitor.api.visita.document.StatusVisita;

import java.time.Instant;

public record HeartbeatResponse(
        StatusVisita status,
        Instant ultimoHeartbeat
) {
}
