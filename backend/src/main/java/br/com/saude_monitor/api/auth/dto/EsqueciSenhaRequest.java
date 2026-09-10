package br.com.saude_monitor.api.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Payload de solicitação do código de redefinição de senha
 * ({@code POST /api/v1/auth/esqueci-senha}).
 */
public record EsqueciSenhaRequest(
        @NotBlank(message = "email é obrigatório")
        @Email(message = "email deve ser válido")
        String email
) {
}
