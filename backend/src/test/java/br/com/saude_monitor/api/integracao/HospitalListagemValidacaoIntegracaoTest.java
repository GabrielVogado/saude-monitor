package br.com.saude_monitor.api.integracao;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Validação dos parâmetros do filtro geoespacial de {@code GET /api/v1/hospitais}
 * (F-01 do pentest de 23/09/2026): {@code raioKm} negativo virava {@code maxDistance}
 * negativa no MongoDB e a exceção subia como HTTP 500. Agora é barrado por Bean
 * Validation, que devolve 400 no envelope padrão.
 *
 * <p>Contexto completo (não MockMvc standalone) de propósito: a validação dos parâmetros
 * de método só ocorre com o {@code MethodValidationPostProcessor} instalado pelo Spring
 * Boot — o harness standalone não o registra, então um teste standalone passaria mesmo
 * com o bug presente.</p>
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
class HospitalListagemValidacaoIntegracaoTest extends IntegracaoTestBase {

    @Container
    static final MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", mongo::getReplicaSetUrl);
    }

    @Test
    void raioKmNegativoRetorna400EmVezDe500() throws Exception {
        mockMvc.perform(get("/api/v1/hospitais")
                        .param("latitude", "-15.8").param("longitude", "-47.9").param("raioKm", "-5"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CAMPOS_INVALIDOS"));
    }

    @Test
    void raioKmZeroRetorna400() throws Exception {
        mockMvc.perform(get("/api/v1/hospitais")
                        .param("latitude", "-15.8").param("longitude", "-47.9").param("raioKm", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CAMPOS_INVALIDOS"));
    }

    @Test
    void raioKmAcimaDoTetoRetorna400() throws Exception {
        mockMvc.perform(get("/api/v1/hospitais")
                        .param("latitude", "-15.8").param("longitude", "-47.9").param("raioKm", "5000"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CAMPOS_INVALIDOS"));
    }

    @Test
    void latitudeForaDaFaixaRetorna400() throws Exception {
        mockMvc.perform(get("/api/v1/hospitais")
                        .param("latitude", "120").param("longitude", "-47.9").param("raioKm", "5"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CAMPOS_INVALIDOS"));
    }

    @Test
    void raioKmValidoContinuaRespondendo200() throws Exception {
        hospitalAtivo();
        mockMvc.perform(get("/api/v1/hospitais")
                        .param("latitude", String.valueOf(LAT))
                        .param("longitude", String.valueOf(LON))
                        .param("raioKm", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    void semFiltroDeRaioContinuaRespondendo200() throws Exception {
        // raioKm ausente: Bean Validation ignora null, o filtro geoespacial não é aplicado.
        mockMvc.perform(get("/api/v1/hospitais"))
                .andExpect(status().isOk());
    }
}
