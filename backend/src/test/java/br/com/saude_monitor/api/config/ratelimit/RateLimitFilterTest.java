package br.com.saude_monitor.api.config.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Testes do rate limiting (F0-04): mapeamento de grupos por rota e bloqueio 429.
 */
class RateLimitFilterTest {

    /** Padroes de producao: os mesmos valores de application.properties. */
    static final RateLimitProperties PADRAO = new RateLimitProperties(10, 60, 1);

    private RateLimitService service;
    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        service = new RateLimitService(PADRAO);
        RateLimitFilter filter = new RateLimitFilter(service, jsonMapper(), PADRAO);
        mockMvc = MockMvcBuilders
                .standaloneSetup(new StubController())
                .addFilters(filter)
                .build();
    }

    private static ObjectMapper jsonMapper() {
        return new ObjectMapper().registerModule(new JavaTimeModule());
    }

    @Test
    void deveMapearLoginComoAuth() {
        RateLimitFilter filter = new RateLimitFilter(service, jsonMapper(), PADRAO);
        assertThat(filter.resolverGrupo("POST", "/api/v1/auth/login"))
                .isEqualTo(RateLimitService.Grupo.AUTH);
        assertThat(filter.resolverGrupo("POST", "/api/v1/auth/refresh"))
                .isEqualTo(RateLimitService.Grupo.AUTH);
    }

    @Test
    void deveMapearEndpointsPublicosComoPublico() {
        RateLimitFilter filter = new RateLimitFilter(service, jsonMapper(), PADRAO);
        assertThat(filter.resolverGrupo("GET", "/api/v1/hospitais"))
                .isEqualTo(RateLimitService.Grupo.PUBLICO);
        assertThat(filter.resolverGrupo("GET", "/api/v1/hospitais/abc/indicadores"))
                .isEqualTo(RateLimitService.Grupo.PUBLICO);
        assertThat(filter.resolverGrupo("POST", "/api/v1/feedbacks"))
                .isEqualTo(RateLimitService.Grupo.PUBLICO);
        assertThat(filter.resolverGrupo("POST", "/api/v1/hospitais/sugestoes"))
                .isEqualTo(RateLimitService.Grupo.PUBLICO);
        assertThat(filter.resolverGrupo("GET", "/api/v1/camadas/regiao-saude"))
                .isEqualTo(RateLimitService.Grupo.PUBLICO);
    }

    @Test
    void naoDeveLimitarEndpointsAutenticados() {
        RateLimitFilter filter = new RateLimitFilter(service, jsonMapper(), PADRAO);
        assertThat(filter.resolverGrupo("GET", "/api/v1/hospitais/sugestoes"))
                .isNull();
        assertThat(filter.resolverGrupo("POST", "/api/v1/hospitais/sugestoes/1/aprovar"))
                .isNull();
        assertThat(filter.resolverGrupo("GET", "/api/v1/contas/visitas"))
                .isNull();
    }

    @Test
    void devePermitirRequisicoesDentroDoLimite() throws Exception {
        for (int i = 0; i < 60; i++) {
            mockMvc.perform(get("/api/v1/hospitais").with(deIp("10.0.0.1")))
                    .andExpect(status().isOk())
                    .andExpect(header().string("X-RateLimit-Limit", "60"));
        }
    }

    @Test
    void deveBloquearCom429EsseEnvelopeQuandoExcedeLimitePublico() throws Exception {
        for (int i = 0; i < 60; i++) {
            mockMvc.perform(get("/api/v1/hospitais").with(deIp("10.0.0.2")))
                    .andExpect(status().isOk());
        }
        mockMvc.perform(get("/api/v1/hospitais").with(deIp("10.0.0.2")))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.code").value("LIMITE_EXCEDIDO"))
                .andExpect(jsonPath("$.traceId").exists());
    }

    @Test
    void deveBloquearLoginApos10Requisicoes() throws Exception {
        for (int i = 0; i < 10; i++) {
            mockMvc.perform(post("/api/v1/auth/login").with(deIp("10.0.0.3"))
                            .contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isOk());
        }
        mockMvc.perform(post("/api/v1/auth/login").with(deIp("10.0.0.3"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("LIMITE_EXCEDIDO"));
    }

    @Test
    void deveManterLimitesIndependentesPorIp() throws Exception {
        for (int i = 0; i < 60; i++) {
            mockMvc.perform(get("/api/v1/hospitais").with(deIp("10.0.0.4")))
                    .andExpect(status().isOk());
        }
        // Ip .4 estourou (1 a mais -> 429); Ip .5 não foi tocado e segue funcionando.
        mockMvc.perform(get("/api/v1/hospitais").with(deIp("10.0.0.4")))
                .andExpect(status().isTooManyRequests());
        mockMvc.perform(get("/api/v1/hospitais").with(deIp("10.0.0.5")))
                .andExpect(status().isOk());
    }

    // ------------------------------------------------ X-Forwarded-For -----------------
    // Antes valia o PRIMEIRO endereco do cabecalho, que e o que o proprio cliente escreve.

    @Test
    void clienteQueForjaOXForwardedForAindaEhLimitado() throws Exception {
        // Mesmo cliente real (ultimo endereco, o que o proxy acrescentou), primeiro endereco
        // diferente a cada chamada: antes cada chamada caia numa chave nova.
        for (int i = 0; i < 60; i++) {
            mockMvc.perform(get("/api/v1/hospitais").header("X-Forwarded-For", "203.0.113." + i + ", 198.51.100.7"))
                    .andExpect(status().isOk());
        }
        mockMvc.perform(get("/api/v1/hospitais").header("X-Forwarded-For", "203.0.113.200, 198.51.100.7"))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void usaOEnderecoAcrescentadoPeloProxyConfiavel() {
        RateLimitFilter filter = new RateLimitFilter(service, jsonMapper(), PADRAO);
        org.springframework.mock.web.MockHttpServletRequest req = new org.springframework.mock.web.MockHttpServletRequest();
        req.setRemoteAddr("169.254.1.1");
        req.addHeader("X-Forwarded-For", "1.1.1.1, 2.2.2.2, 198.51.100.7");
        assertThat(filter.resolverIp(req)).isEqualTo("198.51.100.7");
    }

    @Test
    void variasLinhasDeXForwardedForSaoLidasComoUmaListaSo() {
        // O cliente manda uma linha; o proxy acrescenta OUTRA linha em vez de concatenar.
        // Ler so a primeira devolveria o endereco que o cliente escolheu.
        RateLimitFilter filter = new RateLimitFilter(service, jsonMapper(), PADRAO);
        org.springframework.mock.web.MockHttpServletRequest req = new org.springframework.mock.web.MockHttpServletRequest();
        req.addHeader("X-Forwarded-For", "1.1.1.1");
        req.addHeader("X-Forwarded-For", "198.51.100.7");
        assertThat(filter.resolverIp(req)).isEqualTo("198.51.100.7");
    }

    @Test
    void comDoisProxiesConfiaveisUsaOPenultimoEndereco() {
        RateLimitProperties doisProxies = new RateLimitProperties(10, 60, 2);
        RateLimitFilter filter = new RateLimitFilter(new RateLimitService(doisProxies), jsonMapper(), doisProxies);
        org.springframework.mock.web.MockHttpServletRequest req = new org.springframework.mock.web.MockHttpServletRequest();
        req.addHeader("X-Forwarded-For", "1.1.1.1, 198.51.100.7, 35.191.0.1");
        assertThat(filter.resolverIp(req)).isEqualTo("198.51.100.7");
    }

    @Test
    void semProxyConfiavelIgnoraOCabecalho() {
        RateLimitProperties semProxy = new RateLimitProperties(10, 60, 0);
        RateLimitFilter filter = new RateLimitFilter(new RateLimitService(semProxy), jsonMapper(), semProxy);
        org.springframework.mock.web.MockHttpServletRequest req = new org.springframework.mock.web.MockHttpServletRequest();
        req.setRemoteAddr("10.0.0.9");
        req.addHeader("X-Forwarded-For", "1.1.1.1");
        assertThat(filter.resolverIp(req)).isEqualTo("10.0.0.9");
    }

    @Test
    void cabecalhoMaisCurtoQueOsProxiesCaiNoEnderecoDaConexao() {
        RateLimitProperties doisProxies = new RateLimitProperties(10, 60, 2);
        RateLimitFilter filter = new RateLimitFilter(new RateLimitService(doisProxies), jsonMapper(), doisProxies);
        org.springframework.mock.web.MockHttpServletRequest req = new org.springframework.mock.web.MockHttpServletRequest();
        req.setRemoteAddr("10.0.0.9");
        req.addHeader("X-Forwarded-For", "1.1.1.1");
        assertThat(filter.resolverIp(req)).isEqualTo("10.0.0.9");
    }

    // ------------------------------------------------ Limites configuraveis -----------

    @Test
    void limitesVemDaConfiguracaoDoAmbiente() throws Exception {
        RateLimitProperties homologacao = new RateLimitProperties(10, 100, 1);
        RateLimitService hom = new RateLimitService(homologacao);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new StubController())
                .addFilters(new RateLimitFilter(hom, jsonMapper(), homologacao)).build();
        for (int i = 0; i < 100; i++) {
            mvc.perform(get("/api/v1/hospitais").with(deIp("10.0.0.8")))
                    .andExpect(status().isOk())
                    .andExpect(header().string("X-RateLimit-Limit", "100"));
        }
        mvc.perform(get("/api/v1/hospitais").with(deIp("10.0.0.8")))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Limite: 100 por minuto")));
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor deIp(String ip) {
        return request -> {
            request.setRemoteAddr(ip);
            return request;
        };
    }

    @RestController
    static class StubController {
        @GetMapping("/api/v1/hospitais")
        public String hospitais() {
            return "ok";
        }

        @GetMapping("/api/v1/hospitais/sugestoes")
        public String sugestoes() {
            return "ok";
        }

        @PostMapping("/api/v1/auth/login")
        public String login() {
            return "ok";
        }

        @PostMapping("/api/v1/feedbacks")
        public String feedback() {
            return "ok";
        }

        @PostMapping("/api/v1/hospitais/sugestoes")
        public String sugerir() {
            return "ok";
        }

        @PostMapping("/api/v1/hospitais/sugestoes/1/aprovar")
        public String aprovar() {
            return "ok";
        }
    }
}
