package br.com.saude_monitor.api.integracao;

import br.com.saude_monitor.api.auth.email.EmailService;
import br.com.saude_monitor.api.user.document.Papel;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Sessão do Painel Admin com o refresh em cookie {@code HttpOnly} (ADR-013, SEG-05), com
 * contexto Spring real e Mongo de teste: atributos do cookie, rotação, revogação no logout,
 * recusa de conta não ADMIN e a defesa CSRF (origem exata e {@code X-Requested-With}).
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "app.geofence.reconciliacao.enabled=false",
        "app.cors.allowed-origins=http://localhost:4200,http://localhost:8081",
        "app.cors.painel-origin=" + PainelAuthIntegracaoTest.ORIGEM_PAINEL,
        // Todas as chamadas saem do mesmo IP do MockMvc: o limite de auth (10/min) não é o assunto aqui.
        "app.ratelimit.auth-por-minuto=1000"
})
class PainelAuthIntegracaoTest extends IntegracaoTestBase {

    static final String ORIGEM_PAINEL = "http://localhost:4200";
    private static final String COOKIE = "__Host-painel_refresh";
    private static final String SENHA = "S3nh@Forte!";
    private static final String TRINTA_DIAS_EM_SEGUNDOS = "2592000";

    @Container
    static final MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", mongo::getReplicaSetUrl);
    }

    @MockitoBean
    private EmailService emailService;

    @Autowired
    private UserRepository userRepository;

    /** Cadastra, confirma o e-mail e dá o papel pedido à conta. */
    private String criarConta(String email, Papel papel) throws Exception {
        String corpo = """
                {
                  "fullName": "Conta do Painel",
                  "email": "%s",
                  "password": "%s",
                  "phone": "(61) 99999-0000",
                  "consentimento": { "termosUso": true, "versaoTermos": "1.0" }
                }
                """.formatted(email, SENHA);
        mockMvc.perform(post("/api/v1/auth/registro").contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isCreated());

        ArgumentCaptor<String> codigo = ArgumentCaptor.forClass(String.class);
        verify(emailService).enviarCodigoConfirmacaoEmail(eq(email), codigo.capture());
        mockMvc.perform(post("/api/v1/auth/confirmar-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"email\": \"%s\", \"codigo\": \"%s\" }".formatted(email, codigo.getValue())))
                .andExpect(status().isOk());

        alterarPapel(email, papel);
        return email;
    }

    private void alterarPapel(String email, Papel papel) {
        UserDocument conta = userRepository.findByEmail(email).orElseThrow();
        conta.setPapel(papel);
        userRepository.save(conta);
    }

    /** Requisição como o painel a faz: origem do painel e o cabeçalho anti-CSRF. */
    private static MockHttpServletRequestBuilder doPainel(MockHttpServletRequestBuilder req) {
        return req.header("Origin", ORIGEM_PAINEL).header("X-Requested-With", "painel");
    }

    private static MockHttpServletRequestBuilder corpoDeLogin(MockHttpServletRequestBuilder req, String email,
                                                              String senha) {
        return req.contentType(MediaType.APPLICATION_JSON)
                .content("{ \"email\": \"%s\", \"password\": \"%s\", \"rememberDevice\": false }"
                        .formatted(email, senha));
    }

    private MockHttpServletResponse loginPainel(String email) throws Exception {
        return mockMvc.perform(corpoDeLogin(doPainel(post("/api/v1/auth/painel/login")), email, SENHA))
                .andExpect(status().isOk())
                .andReturn().getResponse();
    }

    private static String valorDoCookie(MockHttpServletResponse resposta) {
        String setCookie = resposta.getHeader(HttpHeaders.SET_COOKIE);
        assertThat(setCookie).startsWith(COOKIE + "=");
        return setCookie.substring(COOKIE.length() + 1, setCookie.indexOf(';'));
    }

    private MockHttpServletResponse refresh(String valorCookie) throws Exception {
        return mockMvc.perform(doPainel(post("/api/v1/auth/painel/refresh")).cookie(new Cookie(COOKIE, valorCookie)))
                .andReturn().getResponse();
    }

    @Test
    void loginDoAdminDevolveAccessNoCorpoERefreshSoNoCookieComOsAtributosCertos() throws Exception {
        String email = criarConta("admin-cookie@saude-teste.com", Papel.ADMIN);

        MockHttpServletResponse resposta = loginPainel(email);

        JsonNode corpo = objectMapper.readTree(resposta.getContentAsString());
        assertThat(corpo.get("accessToken").asText()).isNotBlank();
        assertThat(corpo.get("usuario").get("papel").asText()).isEqualTo("ADMIN");
        assertThat(corpo.has("refreshToken")).isFalse();
        String refresh = valorDoCookie(resposta);
        assertThat(resposta.getContentAsString()).doesNotContain(refresh);

        String setCookie = resposta.getHeader(HttpHeaders.SET_COOKIE);
        assertThat(setCookie).contains("; Path=/").contains("; Max-Age=" + TRINTA_DIAS_EM_SEGUNDOS)
                .contains("; Secure").contains("; HttpOnly").contains("; SameSite=Strict")
                .doesNotContain("Domain=");
        assertThat(resposta.getHeader("Access-Control-Allow-Origin")).isEqualTo(ORIGEM_PAINEL);
        assertThat(resposta.getHeader("Access-Control-Allow-Credentials")).isEqualTo("true");
    }

    @Test
    void refreshRotacionaOCookieEORefreshAntigoNaoServeDepoisDeUsado() throws Exception {
        String email = criarConta("admin-rotacao@saude-teste.com", Papel.ADMIN);
        String original = valorDoCookie(loginPainel(email));

        MockHttpServletResponse renovada = refresh(original);
        assertThat(renovada.getStatus()).isEqualTo(200);
        String rotacionado = valorDoCookie(renovada);
        assertThat(rotacionado).isNotEqualTo(original);
        JsonNode corpo = objectMapper.readTree(renovada.getContentAsString());
        assertThat(corpo.get("accessToken").asText()).isNotBlank();
        assertThat(corpo.has("refreshToken")).isFalse();

        assertThat(refresh(original).getStatus()).isEqualTo(401);
        assertThat(refresh(rotacionado).getStatus()).isEqualTo(200);
    }

    @Test
    void refreshSemCookieEhRecusadoCom401() throws Exception {
        mockMvc.perform(doPainel(post("/api/v1/auth/painel/refresh")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("NAO_AUTORIZADO"));
        assertThat(refresh("").getStatus()).isEqualTo(401);
        assertThat(refresh("lixo-que-nao-e-jwt").getStatus()).isEqualTo(401);
    }

    @Test
    void logoutApagaOCookieERevogaORefresh() throws Exception {
        String email = criarConta("admin-logout@saude-teste.com", Papel.ADMIN);
        String refresh = valorDoCookie(loginPainel(email));

        MockHttpServletResponse saida = mockMvc.perform(doPainel(post("/api/v1/auth/painel/logout"))
                        .cookie(new Cookie(COOKIE, refresh)))
                .andExpect(status().isOk())
                .andReturn().getResponse();

        assertThat(saida.getHeader(HttpHeaders.SET_COOKIE)).startsWith(COOKIE + "=;")
                .contains("; Max-Age=0").contains("; Path=/").contains("; Secure").contains("; HttpOnly")
                .contains("; SameSite=Strict");
        assertThat(refresh(refresh).getStatus()).isEqualTo(401);
    }

    @Test
    void logoutSemCookieTambemApagaOCookie() throws Exception {
        mockMvc.perform(doPainel(post("/api/v1/auth/painel/logout")))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, org.hamcrest.Matchers.containsString("Max-Age=0")));
        mockMvc.perform(doPainel(post("/api/v1/auth/painel/logout")).cookie(new Cookie(COOKIE, "")))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, org.hamcrest.Matchers.containsString("Max-Age=0")));
    }

    @Test
    void contaNaoAdminRecebeOMesmoErroDeCredenciaisInvalidasSemCookie() throws Exception {
        String email = criarConta("usuario-comum@saude-teste.com", Papel.USER);

        MockHttpServletResponse naoAdmin = mockMvc.perform(
                        corpoDeLogin(doPainel(post("/api/v1/auth/painel/login")), email, SENHA))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse();
        MockHttpServletResponse senhaErrada = mockMvc.perform(
                        corpoDeLogin(doPainel(post("/api/v1/auth/painel/login")), email, "senha-errada-1"))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse();

        assertThat(naoAdmin.getHeader(HttpHeaders.SET_COOKIE)).isNull();
        assertThat(objectMapper.readTree(naoAdmin.getContentAsString()).get("message").asText())
                .isEqualTo(objectMapper.readTree(senhaErrada.getContentAsString()).get("message").asText());
    }

    @Test
    void adminQuePerdeuOPapelNaoRenovaMaisASessaoDoPainel() throws Exception {
        String email = criarConta("admin-rebaixado@saude-teste.com", Papel.ADMIN);
        String refresh = valorDoCookie(loginPainel(email));

        alterarPapel(email, Papel.USER);

        assertThat(refresh(refresh).getStatus()).isEqualTo(401);
    }

    @Test
    void origemDiferenteDaDoPainelRecebe403MesmoComCookie() throws Exception {
        // Origem de outra lista do CORS (a do Expo web): autorizada no resto da API, não aqui.
        mockMvc.perform(post("/api/v1/auth/painel/refresh")
                        .header("Origin", "http://localhost:8081")
                        .header("X-Requested-With", "painel")
                        .cookie(new Cookie(COOKIE, "qualquer")))
                .andExpect(status().isForbidden());
        // Parecida, mas não igual: comparação exata, sem prefixo nem barra final.
        mockMvc.perform(post("/api/v1/auth/painel/refresh")
                        .header("Origin", ORIGEM_PAINEL + ".atacante.example")
                        .header("X-Requested-With", "painel")
                        .cookie(new Cookie(COOKIE, "qualquer")))
                .andExpect(status().isForbidden());
    }

    @Test
    void semXRequestedWithOuSemOriginRecebe403() throws Exception {
        String email = criarConta("admin-csrf@saude-teste.com", Papel.ADMIN);

        mockMvc.perform(corpoDeLogin(post("/api/v1/auth/painel/login").header("Origin", ORIGEM_PAINEL), email, SENHA))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE));
        mockMvc.perform(corpoDeLogin(post("/api/v1/auth/painel/login").header("X-Requested-With", "painel"),
                        email, SENHA))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACESSO_NEGADO"));
        mockMvc.perform(post("/api/v1/auth/painel/logout").header("Origin", ORIGEM_PAINEL)
                        .header("X-Requested-With", "outro"))
                .andExpect(status().isForbidden());
    }

    @Test
    void preflightDoPainelLiberaCredenciaisEOCabecalhoDoPainelSoParaAOrigemDoPainel() throws Exception {
        mockMvc.perform(options("/api/v1/auth/painel/refresh")
                        .header("Origin", ORIGEM_PAINEL)
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "Content-Type, X-Requested-With"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", ORIGEM_PAINEL))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));

        mockMvc.perform(options("/api/v1/auth/painel/refresh")
                        .header("Origin", "http://localhost:8081")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));

        // O resto da API continua sem credenciais.
        mockMvc.perform(options("/api/v1/auth/login")
                        .header("Origin", ORIGEM_PAINEL)
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("Access-Control-Allow-Credentials"));
    }

    @Test
    void loginDoAppContinuaComORefreshNoCorpoESemCookie() throws Exception {
        String email = criarConta("admin-no-app@saude-teste.com", Papel.ADMIN);

        MockHttpServletResponse resposta = mockMvc.perform(corpoDeLogin(post("/api/v1/auth/login"), email, SENHA))
                .andExpect(status().isOk())
                .andReturn().getResponse();

        assertThat(objectMapper.readTree(resposta.getContentAsString()).get("refreshToken").asText()).isNotBlank();
        assertThat(resposta.getHeader(HttpHeaders.SET_COOKIE)).isNull();
    }
}
