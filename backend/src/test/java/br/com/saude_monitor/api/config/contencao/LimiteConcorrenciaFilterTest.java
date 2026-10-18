package br.com.saude_monitor.api.config.contencao;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Teto de requisições simultâneas por instância (ARQ-05). */
class LimiteConcorrenciaFilterTest {

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    private final LimiteConcorrenciaFilter filter =
            new LimiteConcorrenciaFilter(new ContencaoProperties(1, 7, 300, false), objectMapper);

    private static MockHttpServletRequest requisicao(String uri) {
        return new MockHttpServletRequest("GET", uri);
    }

    @Test
    void dentroDoTetoAtendeEDevolveAVaga() throws Exception {
        MockHttpServletResponse resposta = new MockHttpServletResponse();
        AtomicReference<Integer> vagasDurante = new AtomicReference<>();

        filter.doFilter(requisicao("/api/v1/hospitais"), resposta,
                (req, res) -> vagasDurante.set(filter.vagasLivres()));

        assertThat(vagasDurante.get()).isZero();
        assertThat(filter.vagasLivres()).isEqualTo(1);
        assertThat(resposta.getStatus()).isEqualTo(200);
    }

    @Test
    void acimaDoTetoResponde503ComRetryAfterNoEnvelopePadrao() throws Exception {
        MockHttpServletResponse recusada = new MockHttpServletResponse();
        AtomicReference<Boolean> segundaPassou = new AtomicReference<>(false);

        // A primeira requisição ocupa a única vaga enquanto a segunda chega.
        filter.doFilter(requisicao("/api/v1/hospitais"), new MockHttpServletResponse(), (req, res) ->
                filter.doFilter(requisicao("/api/v1/catalogo"), recusada, (r2, s2) -> segundaPassou.set(true)));

        assertThat(segundaPassou.get()).isFalse();
        assertThat(recusada.getStatus()).isEqualTo(503);
        assertThat(recusada.getHeader("Retry-After")).isEqualTo("7");
        JsonNode corpo = objectMapper.readTree(recusada.getContentAsString());
        assertThat(corpo.get("code").asText()).isEqualTo(LimiteConcorrenciaFilter.CODIGO);
        assertThat(corpo.get("status").asInt()).isEqualTo(503);
        assertThat(corpo.get("traceId").asText()).isNotBlank();
        assertThat(filter.vagasLivres()).isEqualTo(1);
    }

    @Test
    void actuatorNaoEntraNoTeto() throws Exception {
        MockHttpServletResponse saude = new MockHttpServletResponse();
        AtomicReference<Boolean> saudePassou = new AtomicReference<>(false);

        filter.doFilter(requisicao("/api/v1/hospitais"), new MockHttpServletResponse(), (req, res) ->
                filter.doFilter(requisicao("/actuator/health"), saude, (r2, s2) -> saudePassou.set(true)));

        assertThat(saudePassou.get()).isTrue();
        assertThat(saude.getStatus()).isEqualTo(200);
    }

    @Test
    void devolveAVagaMesmoQuandoARequisicaoFalha() {
        FilterChain falha = (req, res) -> {
            throw new ServletException("erro no controller");
        };

        assertThatThrownBy(() -> filter.doFilter(requisicao("/api/v1/hospitais"), new MockHttpServletResponse(), falha))
                .isInstanceOf(ServletException.class);
        assertThat(filter.vagasLivres()).isEqualTo(1);
    }

    @Test
    void voltaAAtenderDepoisDeUmaRajadaDeRecusas() throws IOException, ServletException {
        filter.doFilter(requisicao("/api/v1/hospitais"), new MockHttpServletResponse(), (req, res) -> {
            filter.doFilter(requisicao("/api/v1/catalogo"), new MockHttpServletResponse(), (r, s) -> { });
            filter.doFilter(requisicao("/api/v1/catalogo"), new MockHttpServletResponse(), (r, s) -> { });
        });
        MockHttpServletResponse depois = new MockHttpServletResponse();

        filter.doFilter(requisicao("/api/v1/catalogo"), depois, (req, res) -> { });

        assertThat(depois.getStatus()).isEqualTo(200);
    }
}
