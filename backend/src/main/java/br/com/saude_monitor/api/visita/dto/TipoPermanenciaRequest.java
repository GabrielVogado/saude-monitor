package br.com.saude_monitor.api.visita.dto;

import br.com.saude_monitor.api.visita.document.TipoPermanencia;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Sinalização de observação/internação (E2-10/RN-24). {@code dispositivoId} prova o aparelho
 * dono quando a visita começou anônima e a pessoa fez login depois (SEG-02).
 */
public record TipoPermanenciaRequest(
        @NotNull TipoPermanencia tipoPermanencia,
        @Size(max = 64, message = "dispositivoId deve ter no máximo 64 caracteres.")
        String dispositivoId
) {
}
