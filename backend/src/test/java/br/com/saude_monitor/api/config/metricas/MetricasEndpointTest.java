package br.com.saude_monitor.api.config.metricas;

import br.com.saude_monitor.api.config.security.JwtService;
import br.com.saude_monitor.api.user.document.Papel;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Métricas de latência (p50/p95/p99) e taxa de erro por endpoint (E8-06).
 *
 * <p>Diferença deliberada do contrato OpenAPI (E8-09): aqui o endpoint expõe detalhe
 * operacional interno (quais rotas estão lentas ou errando), não um contrato para
 * consumidores externos — por isso {@code /actuator/prometheus} exige papel
 * {@code ADMIN}, em vez de ser público.</p>
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.geofence.reconciliacao.enabled=false")
class MetricasEndpointTest {

    @Container
    static final MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", mongo::getReplicaSetUrl);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String token(Papel papel, String email) {
        UserDocument usuario = userRepository.save(UserDocument.builder()
                .fullName("Usuário de teste")
                .email(email)
                .senhaHash(passwordEncoder.encode("Senha!123"))
                .papel(papel)
                .active(true)
                .build());
        return jwtService.generateAccessToken(usuario);
    }

    @Test
    void devePublicarHistogramaDeLatenciaPorEndpointParaAdmin() throws Exception {
        // Gera uma amostra real no timer http.server.requests antes de medir.
        mockMvc.perform(get("/api/v1/hospitais")).andExpect(status().isOk());

        String tokenAdmin = token(Papel.ADMIN, "admin-metrica@saude-teste.com");

        String corpo = mockMvc.perform(get("/actuator/prometheus")
                        .header("Authorization", "Bearer " + tokenAdmin))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        // Histograma real, com a tag "uri" já resolvida para o padrão da rota (não
        // "UNKNOWN") — é dele que p50/p95/p99 por endpoint são calculados
        // (`histogram_quantile()`), e da tag "status" que a taxa de 5xx se deriva.
        assertThat(corpo).contains("http_server_requests_seconds_bucket");
        assertThat(corpo).contains("http_server_requests_seconds_bucket{"
                + "error=\"none\",exception=\"none\",method=\"GET\",outcome=\"SUCCESS\","
                + "status=\"200\",uri=\"/api/v1/hospitais\"");
    }

    /**
     * As três superfícies que o SecurityConfig restringe a ADMIN: o índice de descoberta
     * ("/actuator", que lista os links para os demais) e os dois endpoints de dado. Testar
     * só "/actuator/prometheus" deixaria uma reconfiguração que estreitasse o matcher (ex.:
     * tirar "/actuator/metrics/**" ou "/actuator") passar verde sem que nada acuse.
     */
    private static final List<String> ENDPOINTS_RESTRITOS_A_ADMIN =
            List.of("/actuator", "/actuator/prometheus", "/actuator/metrics");

    @Test
    void deveNegarAcessoSemToken() throws Exception {
        for (String endpoint : ENDPOINTS_RESTRITOS_A_ADMIN) {
            mockMvc.perform(get(endpoint))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Test
    void deveNegarAcessoParaUsuarioComum() throws Exception {
        String tokenUser = token(Papel.USER, "usuario-comum-metrica@saude-teste.com");

        for (String endpoint : ENDPOINTS_RESTRITOS_A_ADMIN) {
            mockMvc.perform(get(endpoint).header("Authorization", "Bearer " + tokenUser))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void devePermitirAdminNosTresEndpointsRestritos() throws Exception {
        String tokenAdmin = token(Papel.ADMIN, "admin-endpoints-restritos@saude-teste.com");

        for (String endpoint : ENDPOINTS_RESTRITOS_A_ADMIN) {
            mockMvc.perform(get(endpoint).header("Authorization", "Bearer " + tokenAdmin))
                    .andExpect(status().isOk());
        }
    }
}
