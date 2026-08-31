package br.com.saude_monitor.api.user.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Payload do cadastro de conta (§3.1 — {@code POST /api/v1/auth/registro}).
 *
 * <p>O {@code consentimento} LGPD é obrigatório (termos de uso) — sem ele o cadastro
 * é recusado, preservando a base legal do tratamento (RC-06).</p>
 */
public record UserRequest(
        @NotBlank(message = "fullName is required") String fullName,
        @NotBlank(message = "email is required")
        @Email(message = "email must be valid")
        String email,
        @NotBlank(message = "password is required") String password,
        String phone,
        @NotNull(message = "consentimento é obrigatório") @Valid ConsentimentoRequest consentimento
) {
}