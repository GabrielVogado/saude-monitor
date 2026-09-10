package br.com.saude_monitor.api.config.openapi;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.Iterator;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Contrato OpenAPI publicado e servido pela aplicação (E8-09).
 *
 * <p>O CA pede que a especificação "cubra os endpoints REST atuais". Eram 31 endpoints na
 * entrega original (E8-09); a feature de recuperação de senha ("esqueci minha senha",
 * 10/09/2026) acrescentou 2 (`/auth/esqueci-senha`, `/auth/redefinir-senha`), somando
 * **33**. Este teste mede o total de operações que o springdoc realmente gera, não
 * presume que bateu.</p>
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.geofence.reconciliacao.enabled=false")
class OpenApiContratoTest {

    /** Chaves de verbo HTTP que o OpenAPI usa sob cada entrada de `paths`. */
    private static final Set<String> VERBOS_HTTP = Set.of("get", "post", "put", "patch", "delete");

    @Container
    static final MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", mongo::getReplicaSetUrl);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void deveServirOContratoComTodosOsEndpointsReais() throws Exception {
        String corpo = mockMvc.perform(get("/v3/api-docs").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode raiz = objectMapper.readTree(corpo);
        JsonNode paths = raiz.get("paths");
        assertThat(paths).isNotNull();

        int operacoes = 0;
        Iterator<String> caminhos = paths.fieldNames();
        while (caminhos.hasNext()) {
            JsonNode operacoesDoCaminho = paths.get(caminhos.next());
            Iterator<String> verbos = operacoesDoCaminho.fieldNames();
            while (verbos.hasNext()) {
                if (VERBOS_HTTP.contains(verbos.next())) {
                    operacoes++;
                }
            }
        }

        assertThat(operacoes).isEqualTo(33);
    }

    /**
     * O bean {@link OpenApiConfig} declara um requisito de segurança **global**
     * (Bearer/JWT) para poder documentar os endpoints protegidos — mas isso, sozinho,
     * marcaria também os públicos como exigindo token, contradizendo o
     * {@code SecurityConfig} real (achado do code-review deste PR). Os 15 endpoints
     * `permitAll` recebem {@code @SecurityRequirements} vazio para sobrepor o global;
     * este teste mede que a sobreposição chegou ao contrato publicado — e que nenhum
     * dos demais ganhou a mesma isenção por engano. Lista ampliada em 10/09/2026 com os
     * 2 endpoints de "esqueci minha senha" (17 públicos ao todo).
     */
    @Test
    void devePublicarSegurancaCoerenteComOSecurityConfig() throws Exception {
        Set<String> publicos = Set.of(
                "POST /api/v1/auth/registro",
                "POST /api/v1/auth/login",
                "POST /api/v1/auth/refresh",
                "POST /api/v1/auth/logout",
                "POST /api/v1/auth/esqueci-senha",
                "POST /api/v1/auth/redefinir-senha",
                "POST /api/v1/visitas/checkin",
                "POST /api/v1/visitas/{id}/checkout",
                "POST /api/v1/visitas/{id}/heartbeat",
                "GET /api/v1/visitas/ativas",
                "POST /api/v1/feedbacks",
                "GET /api/v1/hospitais",
                "GET /api/v1/hospitais/ranking",
                "GET /api/v1/hospitais/{id}",
                "GET /api/v1/hospitais/{id}/geofence",
                "GET /api/v1/hospitais/{id}/indicadores",
                "POST /api/v1/hospitais/sugestoes");

        String corpo = mockMvc.perform(get("/v3/api-docs").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode paths = objectMapper.readTree(corpo).get("paths");

        int semRequisitoDeclarado = 0;
        Iterator<String> caminhos = paths.fieldNames();
        while (caminhos.hasNext()) {
            String caminho = caminhos.next();
            JsonNode operacoesDoCaminho = paths.get(caminho);
            Iterator<String> verbos = operacoesDoCaminho.fieldNames();
            while (verbos.hasNext()) {
                String verbo = verbos.next();
                if (!VERBOS_HTTP.contains(verbo)) {
                    continue;
                }
                JsonNode security = operacoesDoCaminho.get(verbo).get("security");
                String chave = verbo.toUpperCase() + " " + caminho;
                boolean semRequisito = security != null && security.isArray() && security.isEmpty();

                if (publicos.contains(chave)) {
                    assertThat(semRequisito)
                            .as("%s deveria ter security:[] (endpoint público)", chave)
                            .isTrue();
                } else {
                    assertThat(security)
                            .as("%s deveria herdar o requisito global (sem override)", chave)
                            .isNull();
                }
                if (semRequisito) {
                    semRequisitoDeclarado++;
                }
            }
        }

        assertThat(semRequisitoDeclarado).isEqualTo(publicos.size());
    }

    @Test
    void devePermitirAcessoSemAutenticacao() throws Exception {
        // O contrato precisa ser público: é assim que um consumidor da API o descobre
        // antes de ter qualquer token.
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk());
    }
}
