package br.com.saude_monitor.api.config.exception;

import java.time.Instant;
import java.util.List;

/**
 * Envelope de erro padrão da API (§1.1 da Especificação da API v2.0).
 */
public record ApiError(
        Instant timestamp,
        int status,
        String code,
        String message,
        List<CampoInvalido> details,
        String traceId
) {
}
