package br.com.saude_monitor.api.config.ratelimit;

import br.com.saude_monitor.api.config.exception.ApiError;
import br.com.saude_monitor.api.config.exception.CampoInvalido;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Filtro de rate limiting (F0-04): aplica limites por IP conforme o grupo do
 * recurso (auth = 10/min, públicos = 60/min) e responde 429 no envelope padrão
 * da API quando o limite é excedido.
 *
 * <p>Endpoints autenticados (com token JWT) não são limitados aqui — a
 * identificação via token já oferece controle granular e evita bloquear usuários
 * legítimos atrás de um mesmo NAT/IP.</p>
 */
@Component
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    static final String HEADER_LIMITE = "X-RateLimit-Limit";

    private final RateLimitService rateLimitService;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        RateLimitService.Grupo grupo = resolverGrupo(request.getMethod(), request.getRequestURI());
        if (grupo == null) {
            filterChain.doFilter(request, response);
            return;
        }

        String ip = resolverIp(request);
        boolean permitido = rateLimitService.tentarConsumir(ip, grupo);

        response.setHeader(HEADER_LIMITE, String.valueOf(grupo.limite()));

        if (!permitido) {
            escrever429(response, grupo);
            return;
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Define o grupo de rate limiting a partir do método e do caminho.
     *
     * @return o grupo, ou {@code null} se o recurso não deve ser limitado
     *         (ex.: endpoints autenticados).
     */
    RateLimitService.Grupo resolverGrupo(String method, String uri) {
        // Auth: login e refresh — limite mais restrito (10/min).
        if (uri.startsWith("/api/v1/auth/")) {
            return RateLimitService.Grupo.AUTH;
        }

        // Endpoints públicos diversos: 60/min.
        if (isPublico(method, uri)) {
            return RateLimitService.Grupo.PUBLICO;
        }

        return null;
    }

    private boolean isPublico(String method, String uri) {
        // Móderação de sugestões (E1-06): GET/POST em /hospitais/sugestoes/** são ADMIN
        // (autenticados em SecurityConfig) — não contam como público genérico.
        if (uri.startsWith("/api/v1/hospitais/sugestoes")) {
            // POST /hospitais/sugestoes (exato) é sugestão anônima pública (E1-05).
            return "POST".equals(method) && "/api/v1/hospitais/sugestoes".equals(uri);
        }
        // GET de hospitais (lista + detalhe + indicadores): públicos.
        if ("GET".equals(method) && uri.startsWith("/api/v1/hospitais")) {
            return true;
        }
        // Feedback anônimo (Épico 03): criação pública.
        if ("POST".equals(method) && uri.startsWith("/api/v1/feedbacks")) {
            return true;
        }
        // Visitas anônimas por dispositivoId (Épico 02).
        if (uri.startsWith("/api/v1/visitas/")) {
            return true;
        }
        // Health/info públicos.
        if (uri.startsWith("/actuator/health") || uri.startsWith("/actuator/info")) {
            return true;
        }
        return false;
    }

    private String resolverIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
        }
        String remote = request.getRemoteAddr();
        return remote != null ? remote : "desconhecido";
    }

    private static final int SC_TOO_MANY_REQUESTS = 429;

    private void escrever429(HttpServletResponse response, RateLimitService.Grupo grupo) throws IOException {
        response.setStatus(SC_TOO_MANY_REQUESTS);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        ApiError body = new ApiError(
                Instant.now(),
                SC_TOO_MANY_REQUESTS,
                "LIMITE_EXCEDIDO",
                "Muitas requisições. Tente novamente em instantes. Limite: "
                        + grupo.limite() + " por minuto.",
                List.<CampoInvalido>of(),
                UUID.randomUUID().toString().replace("-", "")
        );
        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
