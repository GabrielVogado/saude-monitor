package br.com.saude_monitor.api.hospital.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Contrato de entrada para rejeição administrativa de uma sugestão de hospital (E1-06).
 */
public record RejeitarSugestaoRequest(
        @NotBlank(message = "motivo é obrigatório")
        @Size(min = 5, max = 500, message = "motivo deve ter entre 5 e 500 caracteres")
        String motivo
) {
}
