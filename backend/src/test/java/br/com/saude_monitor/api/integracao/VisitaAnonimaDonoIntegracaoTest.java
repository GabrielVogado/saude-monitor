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
 * Regressão de BOLA em visita e feedback anônimos (SEG-02 e ENG-04 da Análise de
 * Escalabilidade e Segurança v1.0): quem só sabe o id da visita, sem o {@code dispositivoId}
 * do aparelho que fez o check-in, não encerra, não mantém viva e não avalia a visita.
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.geofence.reconciliacao.enabled=false")
class VisitaAnonimaDonoIntegracaoTest extends IntegracaoTestBase {

    @Container
    static final MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", mongo::getReplicaSetUrl);
    }

    private String checkinAnonimo(String dispositivoId) throws Exception {
        String resposta = mockMvc.perform(post("/api/v1/visitas/checkin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "hospitalId": "%s", "origem": "MANUAL", "dispositivoId": "%s" }
                                """.formatted(hospitalAtivo(), dispositivoId)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(resposta).get("id").asText();
    }

    private String corpoDispositivo(String dispositivoId) {
        return dispositivoId == null ? "{}" : """
                { "dispositivoId": "%s" }
                """.formatted(dispositivoId);
    }

    @Test
    void heartbeatECheckoutDeVisitaAnonimaExigemOAparelhoDono() throws Exception {
        String dono = "anon-dono-" + System.nanoTime();
        String visitaId = checkinAnonimo(dono);

        for (String intruso : new String[]{null, "anon-intruso-" + System.nanoTime()}) {
            mockMvc.perform(post("/api/v1/visitas/" + visitaId + "/heartbeat")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(corpoDispositivo(intruso)))
                    .andExpect(status().isForbidden());
            mockMvc.perform(post("/api/v1/visitas/" + visitaId + "/checkout")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(corpoDispositivo(intruso)))
                    .andExpect(status().isForbidden());
        }

        mockMvc.perform(post("/api/v1/visitas/" + visitaId + "/heartbeat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoDispositivo(dono)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/visitas/" + visitaId + "/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoDispositivo(dono)))
                .andExpect(status().isOk());
    }

    @Test
    void feedbackDeVisitaAnonimaSoDoAparelhoDonoENaoBloqueiaOLegitimo() throws Exception {
        String dono = "anon-dono-" + System.nanoTime();
        String visitaId = checkinAnonimo(dono);
        mockMvc.perform(post("/api/v1/visitas/" + visitaId + "/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoDispositivo(dono)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/feedbacks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "visitaId": "%s", "nota": 1 }
                                """.formatted(visitaId)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/feedbacks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "visitaId": "%s", "nota": 1, "dispositivoId": "anon-intruso" }
                                """.formatted(visitaId)))
                .andExpect(status().isForbidden());

        // A tentativa do intruso não consumiu a avaliação única da visita (RN-12).
        mockMvc.perform(post("/api/v1/feedbacks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "visitaId": "%s", "nota": 4, "dispositivoId": "%s" }
                                """.formatted(visitaId, dono)))
                .andExpect(status().isCreated());
    }
}
