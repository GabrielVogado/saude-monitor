package br.com.saude_monitor.api.integracao;

import br.com.saude_monitor.api.visita.document.StatusVisita;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import br.com.saude_monitor.api.visita.service.VisitaService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Retenção dos pontos de GPS e update atômico da visita contra Mongo real (DAD-01 e ARQ-04
 * da Análise de Escalabilidade e Segurança v1.0): o heartbeat acrescenta pontos sem regravar
 * o documento, o checkout apaga a trilha e a visita antiga perde conta e aparelho.
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.geofence.reconciliacao.enabled=false")
class VisitaRetencaoGpsIntegracaoTest extends IntegracaoTestBase {

    @Container
    static final MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", mongo::getReplicaSetUrl);
    }

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private VisitaService visitaService;

    private static final String POSICAO = """
            "posicao": { "type": "Point", "coordinates": [-47.88, -15.79] }""";

    private String checkinAnonimo(String dispositivoId) throws Exception {
        String resposta = mockMvc.perform(post("/api/v1/visitas/checkin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "hospitalId": "%s", "origem": "MANUAL", "dispositivoId": "%s", %s }
                                """.formatted(hospitalAtivo(), dispositivoId, POSICAO)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(resposta).get("id").asText();
    }

    @Test
    void heartbeatAcrescentaPontoECheckoutApagaATrilha() throws Exception {
        String aparelho = "anon-retencao-" + System.nanoTime();
        String visitaId = checkinAnonimo(aparelho);

        mockMvc.perform(post("/api/v1/visitas/" + visitaId + "/heartbeat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "dispositivoId": "%s", %s }
                                """.formatted(aparelho, POSICAO)))
                .andExpect(status().isOk());
        assertThat(mongoTemplate.findById(visitaId, VisitaDocument.class).getPontosAmostrais()).hasSize(2);

        mockMvc.perform(post("/api/v1/visitas/" + visitaId + "/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "dispositivoId": "%s", %s }
                                """.formatted(aparelho, POSICAO)))
                .andExpect(status().isOk());

        VisitaDocument encerrada = mongoTemplate.findById(visitaId, VisitaDocument.class);
        assertThat(encerrada.getStatus()).isEqualTo(StatusVisita.FINALIZADA);
        assertThat(encerrada.getPontosAmostrais()).isNullOrEmpty();
        assertThat(encerrada.getSaida()).isNotNull();
        assertThat(encerrada.getDuracaoMinutos()).isNotNull();
    }

    @Test
    void visitaComMaisDe90DiasPerdeContaEAparelho() throws Exception {
        String aparelho = "anon-antiga-" + System.nanoTime();
        String antigaId = checkinAnonimo(aparelho);
        VisitaDocument antiga = mongoTemplate.findById(antigaId, VisitaDocument.class);
        antiga.setEntrada(Instant.now().minus(Duration.ofDays(91)));
        antiga.setUsuarioId("u-antigo");
        mongoTemplate.save(antiga);
        String recenteId = checkinAnonimo("anon-recente-" + System.nanoTime());

        assertThat(visitaService.desvincularVisitasAntigas()).isGreaterThanOrEqualTo(1L);

        VisitaDocument depois = mongoTemplate.findById(antigaId, VisitaDocument.class);
        assertThat(depois.getUsuarioId()).isNull();
        assertThat(depois.getDispositivoId()).isNull();
        assertThat(depois.getPontosAmostrais()).isNullOrEmpty();
        assertThat(depois.getHospitalId()).isNotNull();
        assertThat(mongoTemplate.findById(recenteId, VisitaDocument.class).getDispositivoId()).isNotNull();
        // Rodar de novo não acha mais nada para mudar nessa visita (idempotente).
        visitaService.desvincularVisitasAntigas();
        assertThat(mongoTemplate.findById(antigaId, VisitaDocument.class).getHospitalId())
                .isEqualTo(depois.getHospitalId());
    }
}
