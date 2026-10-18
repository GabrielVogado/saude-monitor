package br.com.saude_monitor.api.config.contencao;

import br.com.saude_monitor.api.config.exception.ApiError;
import br.com.saude_monitor.api.config.exception.CampoInvalido;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 503 no envelope padrão da API, escrito direto por um filtro, antes do Spring MVC (ARQ-05).
 *
 * <p>O {@code Retry-After} é o que o app usa para esperar antes de repetir (ver
 * {@code frontend/src/config/http.js}).</p>
 */
final class RespostaIndisponivel {

    static final int STATUS = HttpServletResponse.SC_SERVICE_UNAVAILABLE;

    private RespostaIndisponivel() {
    }

    static void escrever(HttpServletResponse response, ObjectMapper objectMapper,
                         String codigo, String mensagem, int retryAfterSegundos) throws IOException {
        response.setStatus(STATUS);
        response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(retryAfterSegundos));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        ApiError body = new ApiError(
                Instant.now(),
                STATUS,
                codigo,
                mensagem,
                List.<CampoInvalido>of(),
                UUID.randomUUID().toString().replace("-", "")
        );
        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
