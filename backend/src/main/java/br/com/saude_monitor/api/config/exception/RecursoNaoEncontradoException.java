package br.com.saude_monitor.api.config.exception;

import org.springframework.http.HttpStatus;

/**
 * Recurso não encontrado (404 — {@code RECURSO_NAO_ENCONTRADO}).
 */
public class RecursoNaoEncontradoException extends ApiException {

    public RecursoNaoEncontradoException(String message) {
        super(HttpStatus.NOT_FOUND, "RECURSO_NAO_ENCONTRADO", message);
    }
}
