package br.com.saude_monitor.api.hospital.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Contrato de entrada para aprovação administrativa de uma sugestão de hospital (E1-06).
 */
public record AprovarSugestaoRequest(
        @NotBlank(message = "hospitalId é obrigatório")
        String hospitalId
) {
}
