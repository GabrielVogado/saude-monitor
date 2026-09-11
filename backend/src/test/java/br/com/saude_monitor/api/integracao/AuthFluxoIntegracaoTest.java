package br.com.saude_monitor.api.integracao;

import br.com.saude_monitor.api.auth.email.EmailService;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Fluxo crítico de autenticação (E8-10 — DOD-03): registro → login → refresh (rotação) →
 * logout (revogação), com contexto Spring real e banco de teste (Testcontainers), não
 * testes de controller isolados com serviço mockado.
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.geofence.reconciliacao.enabled=false")
class AuthFluxoIntegracaoTest extends IntegracaoTestBase {

    @Container
    static final MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", mongo::getReplicaSetUrl);
    }

    private static final String SENHA = "S3nh@Forte!";

    // Substitui o Resend real (sem chamada HTTP externa em teste) e, principalmente,
    // permite capturar o código de 6 dígitos gerado no cadastro — o teste não tem como
    // lê-lo de outro jeito, já que só o hash BCrypt é persistido no Mongo.
    @MockitoBean
    private EmailService emailService;

    private String registrar(String email) throws Exception {
        String corpo = """
                {
                  "fullName": "Marina Souza",
                  "email": "%s",
                  "password": "%s",
                  "phone": "(11) 99999-0000",
                  "consentimento": { "termosUso": true, "versaoTermos": "1.0" }
                }
                """.formatted(email, SENHA);

        mockMvc.perform(post("/api/v1/auth/registro")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo))
                .andExpect(status().isCreated());
        return email;
    }

    /** Registra e confirma o e-mail (capturando o código enviado ao {@link EmailService} mockado). */
    private String registrarEConfirmar(String email) throws Exception {
        registrar(email);

        ArgumentCaptor<String> codigoCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).enviarCodigoConfirmacaoEmail(eq(email), codigoCaptor.capture());

        String corpoConfirmacao = """
                { "email": "%s", "codigo": "%s" }
                """.formatted(email, codigoCaptor.getValue());
        mockMvc.perform(post("/api/v1/auth/confirmar-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoConfirmacao))
                .andExpect(status().isOk());
        return email;
    }

    private JsonNode login(String email, String senha) throws Exception {
        String corpo = """
                { "email": "%s", "password": "%s", "rememberDevice": false }
                """.formatted(email, senha);

        String resposta = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(resposta);
    }

    @Test
    void deveRegistrarLogarRenovarERevogarNoLogout() throws Exception {
        String email = registrarEConfirmar("marina-fluxo-auth@saude-teste.com");

        JsonNode tokensLogin = login(email, SENHA);
        String refreshOriginal = tokensLogin.get("refreshToken").asText();
        assertThat(tokensLogin.get("accessToken").asText()).isNotBlank();
        assertThat(tokensLogin.get("usuario").get("email").asText()).isEqualTo(email);

        // Rotação: o refresh usado é revogado, um novo é emitido.
        String corpoRefresh = """
                { "refreshToken": "%s" }
                """.formatted(refreshOriginal);
        String respostaRefresh = mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoRefresh))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String refreshRotacionado = objectMapper.readTree(respostaRefresh).get("refreshToken").asText();
        assertThat(refreshRotacionado).isNotEqualTo(refreshOriginal);

        // O refresh original, já rotacionado, não serve mais.
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoRefresh))
                .andExpect(status().isUnauthorized());

        // Logout revoga o refresh vigente.
        String corpoLogout = """
                { "refreshToken": "%s" }
                """.formatted(refreshRotacionado);
        mockMvc.perform(post("/api/v1/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoLogout))
                .andExpect(status().isOk());

        // Depois do logout, o mesmo refresh não renova mais.
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoLogout))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deveRecusarLoginComSenhaErrada() throws Exception {
        String email = registrarEConfirmar("marina-senha-errada@saude-teste.com");

        String corpo = """
                { "email": "%s", "password": "senha-errada-qualquer", "rememberDevice": false }
                """.formatted(email);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo))
                .andExpect(status().isUnauthorized());
    }

}
