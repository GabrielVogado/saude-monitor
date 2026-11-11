package br.com.saude_monitor.api.auth.dto;

/**
 * Resposta de login e refresh do Painel Admin (ADR-013).
 *
 * <p>Igual à {@link AuthResponse} sem o {@code refreshToken}: no painel o refresh vai só no
 * cookie {@code HttpOnly}, que o JavaScript não lê. O access token fica em memória no painel.</p>
 */
public record PainelAuthResponse(
        String accessToken,
        long expiraEm,
        UsuarioDto usuario
) {

    /** Tira o refresh da resposta de autenticação comum. */
    public static PainelAuthResponse de(AuthResponse resposta) {
        return new PainelAuthResponse(resposta.accessToken(), resposta.expiraEm(), resposta.usuario());
    }
}
