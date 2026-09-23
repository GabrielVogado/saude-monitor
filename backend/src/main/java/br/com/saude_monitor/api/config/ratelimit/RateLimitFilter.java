package br.com.saude_monitor.api.config.ratelimit;

import br.com.saude_monitor.api.config.exception.ApiError;
import br.com.saude_monitor.api.config.exception.CampoInvalido;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Filtro de rate limiting (F0-04): aplica limites por IP conforme o grupo do
 * recurso e responde 429 no envelope padrão da API quando o limite é excedido.
 * Os limites vêm de {@link RateLimitProperties} (padrão: auth 10/min, públicos
 * 60/min; o deploy de homologação os sobe para os testes de desempenho).
 *
 * <p>Endpoints autenticados (com token JWT) não são limitados aqui — a
 * identificação via token já oferece controle granular e evita bloquear usuários
 * legítimos atrás de um mesmo NAT/IP.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    static final String HEADER_LIMITE = "X-RateLimit-Limit";

    private final RateLimitService rateLimitService;
    private final ObjectMapper objectMapper;
    private final RateLimitProperties properties;

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
        long feitas = rateLimitService.registrar(ip, grupo);
        int limite = rateLimitService.limite(grupo);
        boolean permitido = feitas <= limite;

        response.setHeader(HEADER_LIMITE, String.valueOf(limite));

        if (!permitido) {
            // Registra QUEM foi limitado -- e a forma de conferir, em producao, que a chave e
            // o IP real do cliente (e nao o do proxy, que limitaria todo mundo junto). So a
            // PRIMEIRA rejeicao de cada chave por janela: sob ataque, uma linha por minuto
            // por IP, nao uma por requisicao.
            if (feitas == limite + 1L) {
                log.info("[RateLimit] 429 {} para {} em {} {}", grupo, ip, request.getMethod(), request.getRequestURI());
            }
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
        // Auth: login e refresh — limite mais restrito (padrão 10/min).
        if (uri.startsWith("/api/v1/auth/")) {
            return RateLimitService.Grupo.AUTH;
        }

        // Endpoints públicos diversos (padrão 60/min).
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
        // GET de camadas geográficas (F-11, §5): leitura pública de recurso estático.
        if ("GET".equals(method) && uri.startsWith("/api/v1/camadas")) {
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

    /**
     * IP do cliente para a chave do limite.
     *
     * <p>Cada proxy ACRESCENTA ao fim do {@code X-Forwarded-For} o endereço de quem falou
     * com ele; o que vem antes foi escrito pelo próprio cliente e não merece confiança.
     * Por isso vale o N-ésimo endereço contando da direita, com N =
     * {@link RateLimitProperties#proxiesConfiaveis()}. A versão anterior usava o
     * PRIMEIRO — um cliente trocando esse valor a cada requisição nunca era limitado.</p>
     *
     * <p>Cabeçalho com menos endereços do que proxies declarados (ou N = 0) cai no
     * endereço da conexão, que ninguém do lado de fora consegue forjar.</p>
     */
    String resolverIp(HttpServletRequest request) {
        String remote = request.getRemoteAddr();
        String semCabecalho = remote != null ? remote : "desconhecido";

        int confiaveis = properties.proxiesConfiaveis();
        // TODAS as linhas do cabecalho, na ordem: um cliente pode mandar mais de uma linha
        // `X-Forwarded-For`, e ler so a primeira (getHeader) deixaria o endereco do proxy
        // numa linha que nunca e lida -- reabrindo o contorno que este metodo fecha.
        String forwarded = String.join(",", java.util.Collections.list(request.getHeaders("X-Forwarded-For")));
        if (confiaveis <= 0 || forwarded.isBlank()) {
            return semCabecalho;
        }
        String[] enderecos = forwarded.split(",");
        int indice = enderecos.length - confiaveis;
        if (indice < 0) {
            return semCabecalho;
        }
        String ip = enderecos[indice].trim();
        return ip.isEmpty() ? semCabecalho : ip;
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
                        + rateLimitService.limite(grupo) + " por minuto.",
                List.<CampoInvalido>of(),
                UUID.randomUUID().toString().replace("-", "")
        );
        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
