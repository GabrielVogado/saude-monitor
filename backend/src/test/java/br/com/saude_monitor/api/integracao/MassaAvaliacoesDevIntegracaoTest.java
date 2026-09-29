package br.com.saude_monitor.api.integracao;

import br.com.saude_monitor.api.agregado.document.AgregadoHospitalDocument;
import br.com.saude_monitor.api.feedback.document.FeedbackDocument;
import br.com.saude_monitor.api.feedback.seed.MassaAvaliacoesRunner;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A massa de avaliações de desenvolvimento, com contexto Spring real e Mongo real: a
 * carga roda no perfil {@code dev} sobre os hospitais do seed, e o que se verifica é o
 * que o PO vai testar — o ranking com diferenças claras, hospitais sem indicadores e o
 * histórico de avaliações de um usuário de teste logado.
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "app.geofence.reconciliacao.enabled=false",
        "app.massa-avaliacoes.enabled=true",
        "app.massa-avaliacoes.senha=" + MassaAvaliacoesDevIntegracaoTest.SENHA
})
class MassaAvaliacoesDevIntegracaoTest extends IntegracaoTestBase {

    static final String SENHA = "Massa@Dev2026";

    @Container
    static final MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", mongo::getReplicaSetUrl);
    }

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private MassaAvaliacoesRunner runner;

    /**
     * A carga roda em segundo plano depois do {@code ApplicationReadyEvent}: espera os
     * agregados dos 50 hospitais da massa (o banco do container só tem os dela).
     */
    @BeforeEach
    void aguardarCarga() {
        await().atMost(Duration.ofSeconds(60)).until(() ->
                mongoTemplate.count(new Query(), AgregadoHospitalDocument.class) >= 50);
    }

    private JsonNode ranking(String ordem) throws Exception {
        String corpo = mockMvc.perform(get("/api/v1/hospitais/ranking")
                        .param("ordem", ordem).param("page", "0").param("size", "100")) // máximo do endpoint; cobre os ~44 avaliados e parte dos sem indicadores
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(corpo).get("content");
    }

    @Test
    void rankingPorNotaTemHospitaisAvaliadosEmOrdemEDepoisOsSemIndicadores() throws Exception {
        JsonNode content = ranking("NOTA");

        List<Double> notas = new ArrayList<>();
        int semIndicadores = 0;
        for (JsonNode hospital : content) {
            JsonNode indicadores = hospital.get("indicadores");
            if (indicadores.get("indicadoresDisponiveis").asBoolean()) {
                assertThat(semIndicadores).as("avaliado depois de um sem indicadores").isZero();
                notas.add(indicadores.get("notaMedia").asDouble());
            } else {
                semIndicadores++;
            }
        }
        assertThat(notas).hasSizeGreaterThanOrEqualTo(40);
        assertThat(notas).isSortedAccordingTo((a, b) -> Double.compare(b, a));
        assertThat(notas.getFirst() - notas.getLast()).as("amplitude das médias").isGreaterThan(2.0);
        assertThat(semIndicadores).isPositive();
    }

    @Test
    void rankingPorTempoTambemTemDiferencas() throws Exception {
        List<Integer> tempos = new ArrayList<>();
        for (JsonNode hospital : ranking("TEMPO")) {
            JsonNode indicadores = hospital.get("indicadores");
            if (indicadores.get("indicadoresDisponiveis").asBoolean()) {
                tempos.add(indicadores.get("tempoMedianoMinutos").asInt());
            }
        }
        assertThat(tempos).isSorted();
        assertThat(tempos.getLast()).isGreaterThan(tempos.getFirst() * 3);
    }

    @Test
    void usuarioDeTesteLogaEVeOProprioHistoricoDeAvaliacoes() throws Exception {
        String login = """
                { "email": "massa.avaliacoes.01@radarsaude.invalid", "password": "%s", "rememberDevice": false }
                """.formatted(SENHA);
        String resposta = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON).content(login))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String token = objectMapper.readTree(resposta).get("accessToken").asText();

        String historico = mockMvc.perform(get("/api/v1/contas/feedbacks")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(objectMapper.readTree(historico).get("content")).isNotEmpty();
    }

    @Test
    void rodarDeNovoNaoDuplicaAMassa() {
        long usuarios = mongoTemplate.count(new Query(), UserDocument.class);
        long visitas = mongoTemplate.count(new Query(), VisitaDocument.class);
        long feedbacks = mongoTemplate.count(new Query(), FeedbackDocument.class);
        assertThat(feedbacks).isPositive();

        runner.executarCarga();

        assertThat(mongoTemplate.count(new Query(), UserDocument.class)).isEqualTo(usuarios);
        assertThat(mongoTemplate.count(new Query(), VisitaDocument.class)).isEqualTo(visitas);
        assertThat(mongoTemplate.count(new Query(), FeedbackDocument.class)).isEqualTo(feedbacks);
    }
}
