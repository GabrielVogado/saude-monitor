package br.com.saude_monitor.api.config.ratelimit;

import br.com.saude_monitor.api.config.exception.ApiError;
import br.com.saude_monitor.api.config.exception.CampoInvalido;
import br.com.saude_monitor.api.config.security.JwtService;
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
import java.util.regex.Pattern;

/**
 * Filtro de rate limiting (F0-04, ARQ-02): duas camadas por requisição limitada, um teto
 * de abuso por IP e o limite de cada pessoa (usuário, instalação do app ou IP), e 429 no
 * envelope padrão da API quando um deles é excedido. Os limites vêm de
 * {@link RateLimitProperties} (padrão: auth 10/min, públicos 60/min, teto por IP 600/min;
 * o deploy de homologação os sobe para os testes de desempenho).
 *
 * <p>Rotas fora dos grupos (as que exigem login) não são limitadas aqui.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    static final String HEADER_LIMITE = "X-RateLimit-Limit";

    /** Identificador aleatório da instalação do app, enviado sem login (ARQ-02). */
    static final String HEADER_CLIENTE = "X-Cliente-Id";

    /** UUID ou texto curto equivalente; qualquer outra coisa cai no limite por IP. */
    private static final Pattern FORMATO_CLIENTE = Pattern.compile("[A-Za-z0-9-]{16,64}");

    static final String ROTA_REFRESH = "/api/v1/auth/refresh";

    private static final String PREFIXO_IP = "ip:";
    private static final String PREFIXO_BEARER = "Bearer ";

    private final RateLimitService rateLimitService;
    private final ObjectMapper objectMapper;
    private final RateLimitProperties properties;
    private final JwtService jwtService;

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
        // Camada 1: teto de abuso por IP, alto, somando o tráfego limitado (ARQ-02).
        if (excedeu(request, response, RateLimitService.Grupo.IP, PREFIXO_IP + ip, "ip " + ip)) {
            return;
        }

        // Camada 2: limite de cada pessoa. A renovação de sessão não passa por aqui: ela é
        // limitada pelo próprio refresh token, no AuthController, e nunca pelo IP.
        if (!ROTA_REFRESH.equals(request.getRequestURI())) {
            Identidade identidade = identidade(request, grupo, ip);
            response.setHeader(HEADER_LIMITE, String.valueOf(rateLimitService.limite(grupo)));
            if (excedeu(request, response, grupo, identidade.chave(), identidade.descricao())) {
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    /** Chave do limite e como ela aparece no log (sem e-mail nem id em claro). */
    record Identidade(String chave, String descricao) {
    }

    /**
     * Quem conta no limite. Nas rotas públicas: o usuário do access token válido, depois a
     * instalação do app ({@value #HEADER_CLIENTE}), e só então o IP. Atrás do CGNAT das
     * operadoras, centenas de celulares saem pelo mesmo IP; contar por IP fazia o pico de
     * uns derrubar o check-in e o heartbeat dos outros. Nas rotas de autenticação, o IP
     * (o login também é limitado por conta, no AuthController).
     */
    Identidade identidade(HttpServletRequest request, RateLimitService.Grupo grupo, String ip) {
        if (grupo == RateLimitService.Grupo.PUBLICO) {
            String autorizacao = request.getHeader("Authorization");
            if (autorizacao != null && autorizacao.startsWith(PREFIXO_BEARER)) {
                var usuario = jwtService.assuntoDoAccessToken(autorizacao.substring(PREFIXO_BEARER.length()));
                if (usuario.isPresent()) {
                    return new Identidade("usuario:" + usuario.get(), "usuário autenticado");
                }
            }
            String cliente = request.getHeader(HEADER_CLIENTE);
            if (cliente != null && FORMATO_CLIENTE.matcher(cliente).matches()) {
                return new Identidade("cliente:" + cliente, "instalação do app");
            }
        }
        return new Identidade(PREFIXO_IP + ip, "ip " + ip);
    }

    private boolean excedeu(HttpServletRequest request, HttpServletResponse response,
                            RateLimitService.Grupo grupo, String chave, String descricao) throws IOException {
        long feitas = rateLimitService.registrar(chave, grupo);
        int limite = rateLimitService.limite(grupo);
        if (feitas <= limite) {
            return false;
        }
        // Só a PRIMEIRA rejeição de cada chave por janela: sob ataque, uma linha por minuto
        // por chave, não uma por requisição. Para IP, é também a forma de conferir em
        // produção que a chave é o IP real do cliente, e não o do proxy.
        if (feitas == limite + 1L) {
            log.info("[RateLimit] 429 {} para {} em {} {}", grupo, descricao, request.getMethod(), request.getRequestURI());
        }
        response.setHeader(HEADER_LIMITE, String.valueOf(limite));
        escrever429(response, limite);
        return true;
    }

    /**
     * Define o grupo de rate limiting a partir do método e do caminho.
     *
     * @return o grupo, ou {@code null} se o recurso não deve ser limitado
     *         (ex.: endpoints autenticados).
     */
    RateLimitService.Grupo resolverGrupo(String method, String uri) {
        // Auth: cadastro, login, refresh, confirmação e senha.
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
        // Catálogo público de estabelecimentos (ARQ-01).
        if ("GET".equals(method) && "/api/v1/catalogo".equals(uri)) {
            return true;
        }
        // Configuração remota lida pelo app ao abrir (ARQ-09).
        if ("GET".equals(method) && "/api/v1/configuracao".equals(uri)) {
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

    private void escrever429(HttpServletResponse response, int limite) throws IOException {
        response.setStatus(SC_TOO_MANY_REQUESTS);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        ApiError body = new ApiError(
                Instant.now(),
                SC_TOO_MANY_REQUESTS,
                "LIMITE_EXCEDIDO",
                "Muitas requisições. Tente novamente em instantes. Limite: "
                        + limite + " por minuto.",
                List.<CampoInvalido>of(),
                UUID.randomUUID().toString().replace("-", "")
        );
        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
