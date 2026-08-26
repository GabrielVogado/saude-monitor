package br.com.saude_monitor.api.visita.dto;

import br.com.saude_monitor.api.visita.document.TipoPermanencia;
import jakarta.validation.constraints.NotNull;

public record TipoPermanenciaRequest(
        @NotNull TipoPermanencia tipoPermanencia
) {
}
