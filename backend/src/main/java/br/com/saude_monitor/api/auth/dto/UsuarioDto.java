package br.com.saude_monitor.api.auth.dto;

/**
 * Usuário resumido embutido na resposta de autenticação (login/refresh).
 *
 * <p>Espelha o objeto {@code usuario} do contrato {@code POST /api/v1/auth/login}
 * (Especificação da API v2.0, §3.1).</p>
 */
public record UsuarioDto(
        String id,
        String nome,
        String email,
        String papel
) {
}
