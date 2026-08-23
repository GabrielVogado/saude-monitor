package br.com.saude_monitor.api.hospital.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Payload de alteração de status (ativação/desativação) do hospital.
 */
public record AlterarStatusRequest(
        @NotNull(message = "ativo é obrigatório")
        Boolean ativo
) {
}
