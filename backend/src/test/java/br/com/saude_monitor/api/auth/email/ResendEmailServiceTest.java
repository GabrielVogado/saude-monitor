package br.com.saude_monitor.api.auth.email;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Testes do envio de e-mail via Resend (feature "esqueci minha senha", 10/09/2026).
 *
 * <p>Sem chamada HTTP real: {@link MockRestServiceServer} intercepta a requisição que o
 * {@link RestClient} monta.</p>
 */
class ResendEmailServiceTest {

    private static final ResendProperties PROPERTIES = new ResendProperties(
            "test-api-key", "Saúde Monitor <onboarding@resend.dev>");

    @Test
    void enviaOCodigoComOsCamposEsperados() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        ResendEmailService emailService = new ResendEmailService(builder, PROPERTIES, null);

        server.expect(requestTo("https://api.resend.com/emails"))
                .andExpect(method(org.springframework.http.HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer test-api-key"))
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(content().string(org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.containsString("marina@email.com"),
                        org.hamcrest.Matchers.containsString("123456"),
                        org.hamcrest.Matchers.containsString("onboarding@resend.dev"))))
                .andRespond(withSuccess("{\"id\":\"email-1\"}", MediaType.APPLICATION_JSON));

        emailService.enviarCodigoRedefinicaoSenha("marina@email.com", "123456");

        server.verify();
    }

    @Test
    void naoPropagaExcecaoQuandoOResendFalha() {
        // Contrato de EmailService: o fluxo de "esqueci a senha" sempre devolve a mesma
        // resposta genérica — uma falha do provedor não pode virar exceção aqui.
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        ResendEmailService emailService = new ResendEmailService(builder, PROPERTIES, null);

        server.expect(requestTo("https://api.resend.com/emails"))
                .andRespond(withServerError());

        emailService.enviarCodigoRedefinicaoSenha("marina@email.com", "123456");

        server.verify();
    }

    @Test
    void envioTemTetoAbaixoDoPisoDeResposta() {
        // SOL-09: o envio é síncrono; conexão mais leitura precisam caber nos 2 s do piso.
        assertThat(ResendEmailService.TIMEOUT_CONEXAO.plus(ResendEmailService.TIMEOUT_LEITURA))
                .isLessThan(br.com.saude_monitor.api.auth.service.TempoMinimoResposta.PISO);
        assertThat(ResendEmailService.fabricaComTeto()).isNotNull();
    }

    @Test
    void construtorDaAplicacaoNaoAlteraOBuilderCompartilhado() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();

        new ResendEmailService(builder, PROPERTIES);

        // O builder original continua com o servidor simulado: o teto foi posto numa cópia.
        server.expect(requestTo("https://exemplo.test/x")).andRespond(withSuccess());
        builder.build().get().uri("https://exemplo.test/x").retrieve().toBodilessEntity();
        server.verify();
    }
}
