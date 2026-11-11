package br.com.saude_monitor.api.config.security;

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
import org.springframework.web.util.UrlPathHelper;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Defesa CSRF das rotas de sessão do Painel Admin ({@code /api/v1/auth/painel/**}, ADR-013).
 *
 * <p>Nessas rotas o refresh vai no cookie {@code HttpOnly}, que o navegador anexa sozinho,
 * então elas são as únicas da API em que CSRF faz sentido. O {@code SameSite=Strict} do
 * cookie já impede o envio a partir de outro site; este filtro é a segunda barreira, que não
 * depende do navegador: exige o cabeçalho {@code Origin} igual, caractere a caractere, à
 * origem configurada do painel, e o cabeçalho {@value #CABECALHO} com o valor
 * {@value #VALOR}. Um formulário de outro site não consegue pôr cabeçalho próprio, e um
 * {@code fetch} com ele dispara o preflight, que o CORS recusa para qualquer outra origem.
 * Requisição sem {@code Origin} também é recusada.</p>
 *
 * <p>Fica logo depois do {@code CorsFilter}: o preflight é respondido antes de chegar aqui.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PainelCsrfFilter extends OncePerRequestFilter {

    static final String PREFIXO_ROTAS = "/api/v1/auth/painel/";
    static final String CABECALHO = "X-Requested-With";
    static final String VALOR = "painel";

    private final CorsProperties corsProperties;
    private final ObjectMapper objectMapper;

    /**
     * Pelo caminho decodificado, o mesmo que o Spring MVC usa para achar o controller: com a
     * URI crua, {@code /api/v1/auth/%70ainel/refresh} chegaria à rota sem passar por aqui.
     */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !UrlPathHelper.defaultInstance.getPathWithinApplication(request).startsWith(PREFIXO_ROTAS);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        boolean origemDoPainel = corsProperties.painelOrigin().equals(request.getHeader("Origin"));
        boolean cabecalhoDoPainel = VALOR.equals(request.getHeader(CABECALHO));
        if (origemDoPainel && cabecalhoDoPainel) {
            filterChain.doFilter(request, response);
            return;
        }
        log.warn("[PainelCsrf] 403 em {} {}: origem do painel={}, cabeçalho {}={}",
                request.getMethod(), request.getRequestURI(), origemDoPainel, CABECALHO, cabecalhoDoPainel);
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        ApiError body = new ApiError(
                Instant.now(),
                HttpServletResponse.SC_FORBIDDEN,
                "ACESSO_NEGADO",
                "Origem não autorizada.",
                List.<CampoInvalido>of(),
                UUID.randomUUID().toString().replace("-", "")
        );
        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
