package br.com.saude_monitor.api.config.contencao;

import br.com.saude_monitor.api.configuracao.dto.ConfiguracaoRemotaResponse;
import br.com.saude_monitor.api.configuracao.service.ConfiguracaoRemotaService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

/**
 * Modo somente leitura (ARQ-05, ARQ-09): enquanto ligado, a API recusa as gravações dos
 * usuários com 503 {@code MODO_SOMENTE_LEITURA} e {@code Retry-After}, e as consultas
 * (mapa, ranking, detalhe, catálogo) seguem normais. Serve para manutenção ou troca do banco
 * e para segurar a gravação num incidente sem tirar o app do ar.
 *
 * <p>Seguem aceitos: login, renovação e saída da sessão (a pessoa continua entrando no app) e a
 * própria configuração remota (o administrador precisa conseguir desligar o modo).</p>
 */
@Component
@RequiredArgsConstructor
public class ModoSomenteLeituraFilter extends OncePerRequestFilter {

    static final String CODIGO = "MODO_SOMENTE_LEITURA";
    static final String MENSAGEM_PADRAO =
            "O Radar Saúde está em manutenção e só aceita consultas agora. Tente de novo em alguns minutos.";

    private static final Set<String> GRAVACOES = Set.of("POST", "PUT", "PATCH", "DELETE");

    private static final Set<String> SEMPRE_ACEITAS = Set.of(
            "/api/v1/auth/login",
            "/api/v1/auth/refresh",
            "/api/v1/auth/logout",
            "/api/v1/admin/configuracao");

    private final ConfiguracaoRemotaService configuracaoRemotaService;
    private final ContencaoProperties properties;
    private final ObjectMapper objectMapper;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return !GRAVACOES.contains(request.getMethod())
                || !uri.startsWith("/api/")
                || SEMPRE_ACEITAS.contains(uri);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        ConfiguracaoRemotaResponse configuracao = configuracaoRemotaService.obterConfiguracao();
        if (!configuracao.modoSomenteLeitura()) {
            filterChain.doFilter(request, response);
            return;
        }
        String mensagem = configuracao.mensagem() == null || configuracao.mensagem().isBlank()
                ? MENSAGEM_PADRAO
                : configuracao.mensagem();
        RespostaIndisponivel.escreverResposta(response, objectMapper, CODIGO, mensagem,
                properties.retryAfterSomenteLeituraSegundos());
    }
}
