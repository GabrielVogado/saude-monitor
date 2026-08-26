package br.com.saude_monitor.api.visita.dto;

import br.com.saude_monitor.api.visita.document.StatusVisita;

import java.time.Instant;

public record CheckoutResponse(
        String id,
        Instant saida,
        Integer duracaoMinutos,
        StatusVisita status,
        boolean encerramentoManual
) {
}
