package br.com.saude_monitor.api.config.exception;

import br.com.saude_monitor.api.visita.dto.ConflitoGeofenceResponse;
import br.com.saude_monitor.api.visita.service.ConflitoGeofenceException;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.mongodb.MongoTimeoutException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Tratamento global de exceções, padronizando o envelope de erro da API
 * (código estável, mensagem pt-BR, timestamp e {@code traceId}).
 *
 * <p>Cobre validação de request, recursos inexistentes, conflitos, exceções de
 * domínio ({@link ApiException}) e erros não tratados.</p>
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** Espera sugerida ao app quando o banco falha de forma passageira (ARQ-05). */
    static final int RETRY_AFTER_BANCO_SEGUNDOS = 5;

    /** Exceções de domínio já trazem status/código/mensagem/detalhes prontos. */
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> handleApiException(ApiException ex) {
        return build(ex.getStatus(), ex.getCode(), ex.getMessage(), ex.getDetails());
    }

    /** Empate de geofences sobrepostos no check-in (E2-04/RN-05) — 409 com candidatos para o app perguntar. */
    @ExceptionHandler(ConflitoGeofenceException.class)
    public ResponseEntity<ConflitoGeofenceResponse> handleConflitoGeofence(ConflitoGeofenceException ex) {
        ConflitoGeofenceResponse body = new ConflitoGeofenceResponse(
                Instant.now(),
                HttpStatus.CONFLICT.value(),
                "CONFLITO_GEOFENCE",
                ex.getMessage(),
                ex.getCandidatos(),
                UUID.randomUUID().toString().replace("-", "")
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    /** Falha de validação de corpo (@Valid) — detalha cada campo inválido. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
        List<CampoInvalido> details = ex.getBindingResult().getFieldErrors().stream()
                .map(this::toCampoInvalido)
                .toList();
        return build(HttpStatus.BAD_REQUEST, "CAMPOS_INVALIDOS",
                "Requisição contém campos inválidos.", details);
    }

    /** Validação de parâmetros (@Validated em query/path). */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException ex) {
        List<CampoInvalido> details = ex.getConstraintViolations().stream()
                .map(v -> new CampoInvalido(v.getPropertyPath().toString(), v.getMessage()))
                .toList();
        return build(HttpStatus.BAD_REQUEST, "CAMPOS_INVALIDOS",
                "Requisição contém parâmetros inválidos.", details);
    }

    /** JSON malformado ou valor de enum desconhecido. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleNotReadable(HttpMessageNotReadableException ex) {
        return build(HttpStatus.BAD_REQUEST, "CAMPOS_INVALIDOS",
                "Corpo da requisição inválido ou malformado.", List.of());
    }

    /** Parâmetro de query/path com tipo incompatível (ex.: enum inválido em `tipo`). */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        CampoInvalido detalhe = new CampoInvalido(ex.getName(), "valor inválido para o parâmetro");
        return build(HttpStatus.BAD_REQUEST, "CAMPOS_INVALIDOS",
                "Parâmetro de requisição inválido.", List.of(detalhe));
    }

    /** Endpoint/rota inexistente. */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> handleNoResource(NoResourceFoundException ex) {
        return build(HttpStatus.NOT_FOUND, "RECURSO_NAO_ENCONTRADO",
                "Recurso não encontrado.", List.of());
    }

    /**
     * Banco fora do ar, sem conexão livre no pool ou consulta acima do prazo (ARQ-05, SOL-07):
     * falha passageira, então 503 com {@code Retry-After}, e não 500. O app repete sozinho
     * depois da espera; um 500 dizia que o erro era da requisição.
     */
    @ExceptionHandler({DataAccessResourceFailureException.class, QueryTimeoutException.class,
            MongoTimeoutException.class})
    public ResponseEntity<ApiError> handleBancoIndisponivel(Exception ex) {
        log.warn("Banco indisponível: {}", ex.getMessage());
        ResponseEntity<ApiError> resposta = build(HttpStatus.SERVICE_UNAVAILABLE, "BANCO_INDISPONIVEL",
                "Serviço temporariamente indisponível. Tente novamente em instantes.", List.of());
        return ResponseEntity.status(resposta.getStatusCode())
                .header(HttpHeaders.RETRY_AFTER, String.valueOf(RETRY_AFTER_BANCO_SEGUNDOS))
                .body(resposta.getBody());
    }

    /** Fallback: qualquer erro não tratado vira 500 sem vazar detalhes internos. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleGeneric(Exception ex) {
        log.error("Erro não tratado", ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "ERRO_INTERNO",
                "Erro interno do servidor. Tente novamente mais tarde.", List.of());
    }

    private CampoInvalido toCampoInvalido(FieldError error) {
        String mensagem = error.getDefaultMessage() == null
                ? "valor inválido"
                : error.getDefaultMessage();
        return new CampoInvalido(error.getField(), mensagem);
    }

    private ResponseEntity<ApiError> build(HttpStatus status, String code, String message,
                                           List<CampoInvalido> details) {
        ApiError body = new ApiError(
                Instant.now(),
                status.value(),
                code,
                message,
                details,
                UUID.randomUUID().toString().replace("-", "")
        );
        return ResponseEntity.status(status).body(body);
    }
}
