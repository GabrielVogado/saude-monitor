package br.com.saude_monitor.api.integracao;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Confirmação obrigatória de e-mail no cadastro (10/09/2026): login recusado sem confirmar,
 * código errado recusado — com contexto Spring real e banco de teste (Testcontainers).
 *
 * <p>Classe própria, não parte de {@link AuthFluxoIntegracaoTest}: cada
 * {@code POST /api/v1/auth/**} consome a cota do rate limiter (10/min/IP, em memória por
 * contexto Spring — ver {@link IntegracaoTestBase}); somados aos testes já existentes ali,
 * os dois cenários daqui estourariam a cota dentro da mesma classe.</p>
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.geofence.reconciliacao.enabled=false")
class ConfirmacaoEmailFluxoIntegracaoTest extends IntegracaoTestBase {

    @Container
    static final MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", mongo::getReplicaSetUrl);
    }

    private static final String SENHA = "S3nh@Forte!";

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

    @Test
    void deveRecusarLoginComEmailNaoConfirmado() throws Exception {
        // Achado do PO (10/09/2026): sem confirmar o e-mail no cadastro, um endereço com
        // erro de digitação nunca recebe o código de "esqueci minha senha" — a conta fica
        // sem recuperação possível. O login fica bloqueado até confirmar.
        String email = registrar("marina-nao-confirmado@saude-teste.com");

        String corpo = """
                { "email": "%s", "password": "%s", "rememberDevice": false }
                """.formatted(email, SENHA);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo))
                .andExpect(status().isForbidden());
    }

    @Test
    void deveRecusarConfirmacaoDeEmailComCodigoErrado() throws Exception {
        String email = registrar("marina-codigo-errado@saude-teste.com");

        String corpo = """
                { "email": "%s", "codigo": "000000" }
                """.formatted(email);

        mockMvc.perform(post("/api/v1/auth/confirmar-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo))
                .andExpect(status().isUnauthorized());
    }
}
