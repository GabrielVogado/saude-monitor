package br.com.saude_monitor.api.config.exception;

import org.springframework.http.HttpStatus;

/**
 * Falha de autenticação (401 — {@code NAO_AUTORIZADO}).
 *
 * <p>Usada no fluxo de login quando as credenciais são inválidas. A mensagem é
 * propositalmente genérica para não revelar se o e-mail existe (evita enumeração).</p>
 */
public class NaoAutorizadoException extends ApiException {

    public NaoAutorizadoException(String message) {
        super(HttpStatus.UNAUTHORIZED, "NAO_AUTORIZADO", message);
    }
}
