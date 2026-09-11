package br.com.saude_monitor.api.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Payload de confirmação de e-mail no cadastro ({@code POST /api/v1/auth/confirmar-email}).
 */
public record ConfirmarEmailRequest(
        @NotBlank(message = "email é obrigatório")
        @Email(message = "email deve ser válido")
        String email,

        @NotBlank(message = "código é obrigatório")
        String codigo
) {
}
