package br.com.saude_monitor.api.user.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Consentimento LGPD do cadastro (§3.1 — {@code POST /api/v1/auth/registro}).
 *
 * <p>{@code termosUso} é obrigatório = {@code true} (base legal, art. 7º, I) e
 * {@code versaoTermos} registra a versão vigente aceite, para rastreabilidade.</p>
 */
public record ConsentimentoRequest(
        boolean termosUso,
        @NotBlank(message = "versaoTermos é obrigatória") String versaoTermos
) {
}