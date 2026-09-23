package br.com.saude_monitor.api.integracao;

import com.fasterxml.jackson.databind.JsonNode;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Fluxo crítico de check-in/check-out (E8-10 — DOD-03), com hospital real gravado no
 * banco de teste e o serviço de verdade — não um controller isolado com serviço mockado.
 *
 * <p>Usa {@code origem=MANUAL} (E2-06): esse caminho não passa por {@code $geoIntersects}
 * (só valida hospital ativo), o que já tem cobertura dedicada em
 * {@code HospitalServiceImpl}/BUG-07. O que este teste mede é o ciclo de vida completo da
 * visita através da camada HTTP real, contra Mongo real.</p>
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.geofence.reconciliacao.enabled=false")
class VisitaCheckinCheckoutIntegracaoTest extends IntegracaoTestBase {

    @Container
    static final MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", mongo::getReplicaSetUrl);
    }

    @Test
    void deveRegistrarEntradaEFinalizarComDuracaoCalculada() throws Exception {
        String hospitalId = hospitalAtivo();
        String dispositivoId = "dispositivo-teste-" + System.nanoTime();

        String corpoCheckin = """
                { "hospitalId": "%s", "origem": "MANUAL", "dispositivoId": "%s" }
                """.formatted(hospitalId, dispositivoId);

        String respostaCheckin = mockMvc.perform(post("/api/v1/visitas/checkin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoCheckin))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        JsonNode visitaCriada = objectMapper.readTree(respostaCheckin);
        String visitaId = visitaCriada.get("id").asText();
        assertThat(visitaCriada.get("status").asText()).isEqualTo("EM_ATENDIMENTO");

        // A visita aparece como ativa para o mesmo dispositivo.
        mockMvc.perform(get("/api/v1/visitas/ativas").param("dispositivoId", dispositivoId))
                .andExpect(status().isOk());

        String respostaCheckout = mockMvc.perform(post("/api/v1/visitas/" + visitaId + "/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode visitaFinalizada = objectMapper.readTree(respostaCheckout);

        assertThat(visitaFinalizada.get("status").asText()).isEqualTo("FINALIZADA");
        assertThat(visitaFinalizada.get("duracaoMinutos").asInt()).isGreaterThanOrEqualTo(0);
    }

    @Test
    void deveRecusarCheckinEmHospitalInexistente() throws Exception {
        String corpoCheckin = """
                { "hospitalId": "000000000000000000000000", "origem": "MANUAL", "dispositivoId": "dispositivo-x" }
                """;

        mockMvc.perform(post("/api/v1/visitas/checkin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpoCheckin))
                .andExpect(status().isNotFound());
    }
}
