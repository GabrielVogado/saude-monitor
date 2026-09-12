package br.com.saude_monitor.api.regiao.controller;

import br.com.saude_monitor.api.config.exception.GlobalExceptionHandler;
import br.com.saude_monitor.api.regiao.service.RegiaoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.CacheControl;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.concurrent.TimeUnit;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Controller de camadas geográficas (F-11, §5) — standalone MockMvc com o serviço
 * real (os GeoJSON estão no classpath, sem MongoDB).
 */
class RegiaoControllerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        RegiaoService servico = new RegiaoService();
        servico.carregar();

        mockMvc = MockMvcBuilders.standaloneSetup(new RegiaoController(servico))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void deveServirACamadaComoFeatureCollection() throws Exception {
        mockMvc.perform(get("/api/v1/camadas/regiao-administrativa"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.type").value("FeatureCollection"))
                .andExpect(jsonPath("$.features.length()").value(35));
    }

    @Test
    void deveServirAsDemaisCamadas() throws Exception {
        mockMvc.perform(get("/api/v1/camadas/ride"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.features.length()").value(33));
        mockMvc.perform(get("/api/v1/camadas/regiao-saude"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.features.length()").value(7));
        mockMvc.perform(get("/api/v1/camadas/macrorregiao-saude"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.features.length()").value(3));
    }

    @Test
    void deveCachearPorUmDia() throws Exception {
        String esperado = CacheControl.maxAge(1, TimeUnit.DAYS).getHeaderValue();

        mockMvc.perform(get("/api/v1/camadas/ride"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", esperado));
    }

    @Test
    void deveRetornar404ComEnvelopePadraoQuandoTipoDesconhecido() throws Exception {
        mockMvc.perform(get("/api/v1/camadas/bairros"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RECURSO_NAO_ENCONTRADO"))
                .andExpect(jsonPath("$.message", containsString("bairros")));
    }
}
