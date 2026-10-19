package br.com.saude_monitor.api.config.contencao;

import br.com.saude_monitor.api.configuracao.dto.ConfiguracaoRemotaResponse;
import br.com.saude_monitor.api.configuracao.service.ConfiguracaoRemotaService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Modo somente leitura (ARQ-05, ARQ-09). */
class ModoSomenteLeituraFilterTest {

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    private final ConfiguracaoRemotaService configuracao = mock(ConfiguracaoRemotaService.class);
    private final ModoSomenteLeituraFilter filter = new ModoSomenteLeituraFilter(
            configuracao, new ContencaoProperties(80, 5, 300, false), objectMapper);

    private void configurarModo(boolean ligado, String mensagem) {
        when(configuracao.obterConfiguracao()).thenReturn(new ConfiguracaoRemotaResponse(ligado, null, mensagem));
    }

    private boolean isRequisicaoAceita(String metodo, String uri, MockHttpServletResponse resposta) throws Exception {
        AtomicBoolean passou = new AtomicBoolean();
        filter.doFilter(new MockHttpServletRequest(metodo, uri), resposta, (req, res) -> passou.set(true));
        return passou.get();
    }

    @Test
    void ligadoRecusaGravacaoCom503ERetryAfter() throws Exception {
        configurarModo(true, null);
        MockHttpServletResponse resposta = new MockHttpServletResponse();

        assertThat(isRequisicaoAceita("POST", "/api/v1/visitas/checkin", resposta)).isFalse();

        assertThat(resposta.getStatus()).isEqualTo(503);
        assertThat(resposta.getHeader("Retry-After")).isEqualTo("300");
        JsonNode corpo = objectMapper.readTree(resposta.getContentAsString());
        assertThat(corpo.get("code").asText()).isEqualTo(ModoSomenteLeituraFilter.CODIGO);
        assertThat(corpo.get("message").asText()).isEqualTo(ModoSomenteLeituraFilter.MENSAGEM_PADRAO);
    }

    @Test
    void usaAMensagemDaConfiguracaoQuandoHa() throws Exception {
        configurarModo(true, "Troca do banco até 23h.");
        MockHttpServletResponse resposta = new MockHttpServletResponse();

        isRequisicaoAceita("POST", "/api/v1/feedbacks", resposta);

        assertThat(objectMapper.readTree(resposta.getContentAsString()).get("message").asText())
                .isEqualTo("Troca do banco até 23h.");
    }

    @Test
    void mensagemEmBrancoCaiNoTextoPadrao() throws Exception {
        configurarModo(true, "  ");
        MockHttpServletResponse resposta = new MockHttpServletResponse();

        isRequisicaoAceita("DELETE", "/api/v1/contas/eu", resposta);

        assertThat(objectMapper.readTree(resposta.getContentAsString()).get("message").asText())
                .isEqualTo(ModoSomenteLeituraFilter.MENSAGEM_PADRAO);
    }

    @Test
    void desligadoDeixaAGravacaoPassar() throws Exception {
        configurarModo(false, null);

        assertThat(isRequisicaoAceita("PUT", "/api/v1/feedbacks/1", new MockHttpServletResponse())).isTrue();
    }

    @ParameterizedTest
    @CsvSource({
            "GET, /api/v1/hospitais",
            "GET, /api/v1/catalogo",
            "POST, /api/v1/auth/login",
            "POST, /api/v1/auth/refresh",
            "POST, /api/v1/auth/logout",
            "PUT, /api/v1/admin/configuracao",
            "POST, /internal/jobs/indicadores"
    })
    void consultasSessaoEConfiguracaoSeguemNoModoLigado(String metodo, String uri) throws Exception {
        configurarModo(true, null);

        assertThat(isRequisicaoAceita(metodo, uri, new MockHttpServletResponse())).isTrue();
    }
}
