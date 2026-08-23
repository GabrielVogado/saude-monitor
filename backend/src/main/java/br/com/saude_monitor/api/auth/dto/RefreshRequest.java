package br.com.saude_monitor.api.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Payload de renovação de token ({@code POST /api/v1/auth/refresh}).
 */
public record RefreshRequest(
        @NotBlank(message = "refreshToken é obrigatório") String refreshToken
) {
}
