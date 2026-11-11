package br.com.saude_monitor.api.config.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Defesa CSRF das rotas de sessão do painel (ADR-013) olhando o caminho que o MVC roteia. */
class PainelCsrfFilterTest {

    private static final String ORIGEM_PAINEL = "http://localhost:4200";

    private final PainelCsrfFilter filtro = new PainelCsrfFilter(
            new CorsProperties(List.of(ORIGEM_PAINEL), ORIGEM_PAINEL), new ObjectMapper().findAndRegisterModules());

    private MockHttpServletResponse executar(String uri, String origem, String cabecalho) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", uri);
        if (origem != null) {
            request.addHeader("Origin", origem);
        }
        if (cabecalho != null) {
            request.addHeader("X-Requested-With", cabecalho);
        }
        MockHttpServletResponse response = new MockHttpServletResponse();
        filtro.doFilter(request, response, new MockFilterChain());
        return response;
    }

    @Test
    void caminhoComLetraCodificadaTambemPassaPelaDefesa() throws Exception {
        assertThat(executar("/api/v1/auth/%70ainel/refresh", null, null).getStatus()).isEqualTo(403);
        assertThat(executar("/api/v1/auth/painel/%72efresh", "https://atacante.example", "painel").getStatus())
                .isEqualTo(403);
    }

    @Test
    void requisicaoDoPainelSegue() throws Exception {
        assertThat(executar("/api/v1/auth/painel/refresh", ORIGEM_PAINEL, "painel").getStatus()).isEqualTo(200);
    }

    @Test
    void rotasForaDoPainelNaoSaoAfetadas() throws Exception {
        assertThat(executar("/api/v1/auth/refresh", null, null).getStatus()).isEqualTo(200);
        assertThat(executar("/api/v1/hospitais", "https://atacante.example", null).getStatus()).isEqualTo(200);
    }
}
