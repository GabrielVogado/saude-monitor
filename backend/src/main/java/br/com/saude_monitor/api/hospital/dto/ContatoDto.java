package br.com.saude_monitor.api.hospital.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

/**
 * Canais de contato do estabelecimento (entrada e saída).
 */
public record ContatoDto(
        @Size(max = 20, message = "telefone deve ter no máximo 20 caracteres")
        String telefone,

        @Email(message = "e-mail deve ser válido")
        @Size(max = 200, message = "e-mail deve ter no máximo 200 caracteres")
        String email
) {
}
