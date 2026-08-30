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

    private RateLimitService service;
    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        service = new RateLimitService();
        RateLimitFilter filter = new RateLimitFilter(service, jsonMapper());
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
        RateLimitFilter filter = new RateLimitFilter(service, jsonMapper());
        assertThat(filter.resolverGrupo("POST", "/api/v1/auth/login"))
                .isEqualTo(RateLimitService.Grupo.AUTH);
        assertThat(filter.resolverGrupo("POST", "/api/v1/auth/refresh"))
                .isEqualTo(RateLimitService.Grupo.AUTH);
    }

    @Test
    void deveMapearEndpointsPublicosComoPublico() {
        RateLimitFilter filter = new RateLimitFilter(service, jsonMapper());
        assertThat(filter.resolverGrupo("GET", "/api/v1/hospitais"))
                .isEqualTo(RateLimitService.Grupo.PUBLICO);
        assertThat(filter.resolverGrupo("GET", "/api/v1/hospitais/abc/indicadores"))
                .isEqualTo(RateLimitService.Grupo.PUBLICO);
        assertThat(filter.resolverGrupo("POST", "/api/v1/feedbacks"))
                .isEqualTo(RateLimitService.Grupo.PUBLICO);
        assertThat(filter.resolverGrupo("POST", "/api/v1/hospitais/sugestoes"))
                .isEqualTo(RateLimitService.Grupo.PUBLICO);
    }

    @Test
    void naoDeveLimitarEndpointsAutenticados() {
        RateLimitFilter filter = new RateLimitFilter(service, jsonMapper());
        assertThat(filter.resolverGrupo("GET", "/api/v1/hospitais/sugestoes"))
                .isNull();
        assertThat(filter.resolverGrupo("POST", "/api/v1/hospitais/sugestoes/1/aprovar"))
                .isNull();
        assertThat(filter.resolverGrupo("GET", "/api/v1/usuarios/me"))
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
