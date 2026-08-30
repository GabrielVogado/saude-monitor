package br.com.saude_monitor.api.agregado.controller;

import br.com.saude_monitor.api.agregado.dto.IndicadoresDetalheResponse;
import br.com.saude_monitor.api.agregado.service.AgregadoService;
import br.com.saude_monitor.api.config.security.AutenticacaoHelper;
import br.com.saude_monitor.api.hospital.controller.HospitalController;
import br.com.saude_monitor.api.hospital.service.HospitalService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Testes do endpoint público {@code GET /api/v1/hospitais/{id}/indicadores} (§3.5 / Épico 04).
 * Standalone MockMvc, sem MongoDB/Security.
 */
class IndicadoresControllerTest {

    private final HospitalService hospitalService = mock(HospitalService.class);
    private final AgregadoService agregadoService = mock(AgregadoService.class);

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new HospitalController(hospitalService, new AutenticacaoHelper(null), agregadoService))
                .build();
    }

    @Test
    void deveRetornarIndicadoresDisponiveis() throws Exception {
        var detalhe = new IndicadoresDetalheResponse(
                "hosp-1", true, 4.2, 12, 95, 34,
                new IndicadoresDetalheResponse.Periodo(
                        Instant.parse("2026-05-10T00:00:00Z"),
                        Instant.parse("2026-08-07T23:59:59Z")),
                Instant.parse("2026-08-07T16:55:05Z"));
        when(agregadoService.obterDetalhe("hosp-1")).thenReturn(detalhe);

        mockMvc.perform(get("/api/v1/hospitais/hosp-1/indicadores"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hospitalId").value("hosp-1"))
                .andExpect(jsonPath("$.indicadoresDisponiveis").value(true))
                .andExpect(jsonPath("$.notaMedia").value(4.2))
                .andExpect(jsonPath("$.nAvaliacoes").value(12))
                .andExpect(jsonPath("$.tempoMedianoMinutos").value(95))
                .andExpect(jsonPath("$.nVisitas").value(34))
                .andExpect(jsonPath("$.periodo.inicio").value("2026-05-10T00:00:00Z"))
                .andExpect(jsonPath("$.periodo.fim").value("2026-08-07T23:59:59Z"));
    }

    @Test
    void deveRetornarIndisponivelQuandoNAbaixoDe5() throws Exception {
        var detalhe = IndicadoresDetalheResponse.indisponivel("hosp-1");
        when(agregadoService.obterDetalhe("hosp-1")).thenReturn(detalhe);

        mockMvc.perform(get("/api/v1/hospitais/hosp-1/indicadores"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.indicadoresDisponiveis").value(false))
                .andExpect(jsonPath("$.notaMedia").doesNotExist());
    }

    @Test
    void deveRetornar404QuandoHospitalNaoExistir() throws Exception {
        when(agregadoService.obterDetalhe("inexistente")).thenReturn(null);

        mockMvc.perform(get("/api/v1/hospitais/inexistente/indicadores"))
                .andExpect(status().isNotFound());
    }
}
