package br.com.saude_monitor.api.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Payload de redefinição de senha ({@code POST /api/v1/auth/redefinir-senha}).
 */
public record RedefinirSenhaRequest(
        @NotBlank(message = "email é obrigatório")
        @Email(message = "email deve ser válido")
        String email,

        @NotBlank(message = "código é obrigatório")
        String codigo,

        @NotBlank(message = "novaSenha é obrigatória")
        String novaSenha
) {
}
