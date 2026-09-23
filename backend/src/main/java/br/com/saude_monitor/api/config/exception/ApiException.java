package br.com.saude_monitor.api.config.exception;

import org.springframework.http.HttpStatus;

import java.util.List;

/**
 * Exceção base de domínio da API.
 *
 * <p>Carrega o HTTP status, o código estável de erro (para automação de testes) e a
 * mensagem amigável em pt-BR, além de detalhes de campo opcionais. É traduzida pelo
 * {@link GlobalExceptionHandler} no envelope padrão (§1.1 da Especificação da API).</p>
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final List<CampoInvalido> details;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, List.of());
    }

    public ApiException(HttpStatus status, String code, String message, List<CampoInvalido> details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public List<CampoInvalido> getDetails() {
        return details;
    }
}
