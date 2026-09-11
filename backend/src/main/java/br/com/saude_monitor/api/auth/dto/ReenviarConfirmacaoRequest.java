package br.com.saude_monitor.api.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Payload de reenvio do código de confirmação de e-mail
 * ({@code POST /api/v1/auth/reenviar-confirmacao}).
 */
public record ReenviarConfirmacaoRequest(
        @NotBlank(message = "email é obrigatório")
        @Email(message = "email deve ser válido")
        String email
) {
}
