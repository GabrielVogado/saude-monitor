package br.com.saude_monitor.api.integracao;

import br.com.saude_monitor.api.agregado.repository.AgregadoHospitalRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Fluxo crítico de feedback e agregação (E8-10 — DOD-03): visita finalizada → feedback →
 * recálculo do agregado do hospital, com contexto Spring real, Mongo real e o listener
 * assíncrono de verdade ({@link br.com.saude_monitor.api.agregado.service.impl.FeedbackSalvoEventListener}),
 * não um evento disparado manualmente contra um serviço mockado.
 *
 * <p>O recálculo é {@code @Async}: por isso a verificação do agregado usa Awaitility em
 * vez de assumir que já aconteceu quando o POST /feedbacks retorna.</p>
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.geofence.reconciliacao.enabled=false")
class FeedbackEAgregacaoIntegracaoTest extends IntegracaoTestBase {

    @Container
    static final MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", mongo::getReplicaSetUrl);
    }

    private static final String SENHA = "S3nh@Forte!";

    @Autowired
    private AgregadoHospitalRepository agregadoHospitalRepository;

    private String tokenDeUsuarioNovo(String email) throws Exception {
        String corpoRegistro = """
                {
                  "fullName": "Usuário de Teste",
                  "email": "%s",
                  "password": "%s",
                  "consentimento": { "termosUso": true, "versaoTermos": "1.0" }
                }
                """.formatted(email, SENHA);
        mockMvc.perform(post("/api/v1/auth/registro")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoRegistro))
                .andExpect(status().isCreated());

        String corpoLogin = """
                { "email": "%s", "password": "%s", "rememberDevice": false }
                """.formatted(email, SENHA);
        String resposta = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoLogin))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(resposta).get("accessToken").asText();
    }

    /** Visita FINALIZADA, dona do {@code token}, no hospital informado. */
    private String visitaFinalizada(String hospitalId, String token) throws Exception {
        String corpoCheckin = """
                { "hospitalId": "%s", "origem": "MANUAL" }
                """.formatted(hospitalId);
        String respostaCheckin = mockMvc.perform(post("/api/v1/visitas/checkin")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoCheckin))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String visitaId = objectMapper.readTree(respostaCheckin).get("id").asText();

        mockMvc.perform(post("/api/v1/visitas/" + visitaId + "/checkout")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());
        return visitaId;
    }

    @Test
    void deveCriarConsultarEEditarFeedbackDoDono() throws Exception {
        String hospitalId = hospitalAtivo();
        String token = tokenDeUsuarioNovo("dono-feedback@saude-teste.com");
        String visitaId = visitaFinalizada(hospitalId, token);

        String corpoFeedback = """
                { "visitaId": "%s", "nota": 4, "comentario": "Atendimento rápido." }
                """.formatted(visitaId);
        String respostaCriacao = mockMvc.perform(post("/api/v1/feedbacks")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoFeedback))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String feedbackId = objectMapper.readTree(respostaCriacao).get("id").asText();

        String respostaConsulta = mockMvc.perform(get("/api/v1/visitas/" + visitaId + "/feedback")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(objectMapper.readTree(respostaConsulta).get("nota").asInt()).isEqualTo(4);

        String corpoEdicao = """
                { "visitaId": "%s", "nota": 5, "comentario": "Revendo: excelente." }
                """.formatted(visitaId);
        mockMvc.perform(put("/api/v1/feedbacks/" + feedbackId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoEdicao))
                .andExpect(status().isOk());

        String respostaAposEdicao = mockMvc.perform(get("/api/v1/visitas/" + visitaId + "/feedback")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(objectMapper.readTree(respostaAposEdicao).get("nota").asInt()).isEqualTo(5);
    }

    @Test
    void deveRecusarSegundoFeedbackNaMesmaVisita() throws Exception {
        String hospitalId = hospitalAtivo();
        String token = tokenDeUsuarioNovo("duplicado-feedback@saude-teste.com");
        String visitaId = visitaFinalizada(hospitalId, token);

        String corpoFeedback = """
                { "visitaId": "%s", "nota": 3 }
                """.formatted(visitaId);
        mockMvc.perform(post("/api/v1/feedbacks")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoFeedback))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/feedbacks")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoFeedback))
                .andExpect(status().isConflict());
    }

    @Test
    void deveRecalcularOAgregadoDoHospitalAposOFeedback() throws Exception {
        String hospitalId = hospitalAtivo();
        String token = tokenDeUsuarioNovo("agregacao@saude-teste.com");
        String visitaId = visitaFinalizada(hospitalId, token);

        assertThat(agregadoHospitalRepository.findByHospitalId(hospitalId)).isEmpty();

        String corpoFeedback = """
                { "visitaId": "%s", "nota": 5 }
                """.formatted(visitaId);
        mockMvc.perform(post("/api/v1/feedbacks")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoFeedback))
                .andExpect(status().isCreated());

        // O listener é @Async (FeedbackSalvoEventListener) — aguarda o recálculo real,
        // não assume que já aconteceu quando o POST retornou.
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> {
            var agregado = agregadoHospitalRepository.findByHospitalId(hospitalId);
            assertThat(agregado).isPresent();
            assertThat(agregado.get().getNAvaliacoes()).isEqualTo(1);
            assertThat(agregado.get().getNotaMedia()).isEqualTo(5.0);
        });
    }
}
