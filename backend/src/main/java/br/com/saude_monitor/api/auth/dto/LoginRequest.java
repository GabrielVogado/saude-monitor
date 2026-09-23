package br.com.saude_monitor.api.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Payload de login ({@code POST /api/v1/auth/login}).
 */
public record LoginRequest(
        @NotBlank(message = "email é obrigatório")
        @Email(message = "email deve ser válido")
        String email,

        @NotBlank(message = "senha é obrigatória")
        String password,

        boolean rememberDevice
) {
}
