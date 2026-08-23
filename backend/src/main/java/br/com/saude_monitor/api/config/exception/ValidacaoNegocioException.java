package br.com.saude_monitor.api.config.exception;

import org.springframework.http.HttpStatus;

import java.util.List;

/**
 * Falha de validação de negócio (400 — {@code CAMPOS_INVALIDOS}).
 *
 * <p>Usada, por exemplo, quando o polígono do geofence viola regras geométricas
 * que não são expressáveis via Bean Validation.</p>
 */
public class ValidacaoNegocioException extends ApiException {

    public ValidacaoNegocioException(String message) {
        super(HttpStatus.BAD_REQUEST, "CAMPOS_INVALIDOS", message);
    }

    public ValidacaoNegocioException(String message, List<CampoInvalido> details) {
        super(HttpStatus.BAD_REQUEST, "CAMPOS_INVALIDOS", message, details);
    }
}
