package br.com.saude_monitor.api.config.exception;

import org.springframework.http.HttpStatus;

/**
 * Violação de unicidade/estado (409 — {@code CONFLITO}).
 */
public class ConflitoException extends ApiException {

    public ConflitoException(String message) {
        super(HttpStatus.CONFLICT, "CONFLITO", message);
    }
}
