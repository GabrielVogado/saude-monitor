package br.com.saude_monitor.api.config.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * CORS do backend para o Painel Administrativo Web (CORS-01, Épico 7 / F-11).
 *
 * <p>Medido em 25/09/2026: o painel Angular em {@code http://localhost:4200} não conseguia
 * chamar a API — {@code fetch} normal falhava com "Failed to fetch" enquanto o mesmo
 * {@code fetch} em {@code mode: 'no-cors'} devolvia resposta opaque (o servidor era
 * alcançável); faltavam os cabeçalhos {@code Access-Control-Allow-Origin}. O app mobile é
 * React Native nativo e nunca sofreu CORS.</p>
 *
 * <p>A property {@code app.cors.allowed-origins} é forçada aqui a um valor conhecido para o
 * teste não depender do padrão do {@code application.properties} — mede o mecanismo, não a
 * configuração de um ambiente específico.</p>
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "app.geofence.reconciliacao.enabled=false",
        "app.cors.allowed-origins=http://localhost:4200,https://admin.saude-monitor.app"
})
class CorsConfigTest {

    private static final String ORIGEM_PAINEL = "http://localhost:4200";
    private static final String ORIGEM_NAO_AUTORIZADA = "https://site-malicioso.example";
    /** Endpoint público (permitAll): isola o CORS de qualquer exigência de autenticação. */
    private static final String ENDPOINT_LOGIN = "/api/v1/auth/login";

    @Container
    static final MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", mongo::getReplicaSetUrl);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void preflightDaOrigemDoPainelRecebeCabecalhosCors() throws Exception {
        mockMvc.perform(options(ENDPOINT_LOGIN)
                        .header("Origin", ORIGEM_PAINEL)
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "Authorization, Content-Type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", ORIGEM_PAINEL))
                .andExpect(header().string("Access-Control-Allow-Methods", containsString("POST")))
                // PATCH permanece autorizado porque a API o expõe (edição de hospital pelo ADMIN).
                .andExpect(header().string("Access-Control-Allow-Methods", containsString("PATCH")))
                .andExpect(header().string("Access-Control-Allow-Headers", containsString("Authorization")))
                .andExpect(header().string("Access-Control-Allow-Headers", containsString("Content-Type")));
    }

    @Test
    void preflightDeOrigemNaoAutorizadaNaoRecebeAccessControlAllowOrigin() throws Exception {
        mockMvc.perform(options(ENDPOINT_LOGIN)
                        .header("Origin", ORIGEM_NAO_AUTORIZADA)
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void preflightComCabecalhoForaDoContratoEhRejeitado() throws Exception {
        // allowedHeaders é a lista fechada Authorization/Content-Type, não "*": um cabeçalho
        // customizado no preflight é recusado — se voltasse a "*", este teste ficaria verde à toa.
        mockMvc.perform(options(ENDPOINT_LOGIN)
                        .header("Origin", ORIGEM_PAINEL)
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "X-Cabecalho-Nao-Previsto"))
                .andExpect(status().isForbidden())
                .andExpect(header().string("Access-Control-Allow-Headers",
                        not(containsString("X-Cabecalho-Nao-Previsto"))));
    }

    @Test
    void requisicaoRealDaOrigemDoPainelCarregaAccessControlAllowOrigin() throws Exception {
        // Não é só o preflight: a resposta à chamada de fato também precisa do ACAO, senão o
        // navegador esconde o corpo do login. O status do login não importa aqui (corpo vazio →
        // validação), só o cabeçalho CORS.
        mockMvc.perform(post(ENDPOINT_LOGIN)
                        .header("Origin", ORIGEM_PAINEL)
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(header().string("Access-Control-Allow-Origin", ORIGEM_PAINEL));
    }
}
