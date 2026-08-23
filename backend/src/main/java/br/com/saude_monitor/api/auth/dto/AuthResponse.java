package br.com.saude_monitor.api.auth.dto;

/**
 * Resposta de autenticação (login e refresh) — JWT (F0-01).
 *
 * <p>Contrato alinhado à Especificação da API v2.0 (§3.1):</p>
 * <ul>
 *   <li>{@code accessToken} — JWT de curta duração (15 min);</li>
 *   <li>{@code refreshToken} — JWT de longa duração (30 dias), rotacionado;</li>
 *   <li>{@code expiraEm} — validade do access token em segundos;</li>
 *   <li>{@code usuario} — dados resumidos do usuário autenticado.</li>
 * </ul>
 */
public record AuthResponse(
        String accessToken,
        String refreshToken,
        long expiraEm,
        UsuarioDto usuario
) {
}
