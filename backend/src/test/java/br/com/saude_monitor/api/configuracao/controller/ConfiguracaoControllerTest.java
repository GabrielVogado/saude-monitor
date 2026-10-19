package br.com.saude_monitor.api.configuracao.controller;

import br.com.saude_monitor.api.config.exception.GlobalExceptionHandler;
import br.com.saude_monitor.api.config.security.AutenticacaoHelper;
import br.com.saude_monitor.api.configuracao.dto.ConfiguracaoRemotaRequest;
import br.com.saude_monitor.api.configuracao.dto.ConfiguracaoRemotaResponse;
import br.com.saude_monitor.api.configuracao.service.ConfiguracaoRemotaService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Leitura pública e alteração pelo ADMIN da configuração remota (ARQ-09). */
class ConfiguracaoControllerTest {

    private final ConfiguracaoRemotaService servico = mock(ConfiguracaoRemotaService.class);
    private final AutenticacaoHelper autenticacao = mock(AutenticacaoHelper.class);
    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.standaloneSetup(
                        new ConfiguracaoController(servico),
                        new AdminConfiguracaoController(servico, autenticacao))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void leituraPublicaComCacheDeUmMinuto() throws Exception {
        when(servico.obterConfiguracao()).thenReturn(new ConfiguracaoRemotaResponse(true, "1.0.0", null));

        mockMvc.perform(get("/api/v1/configuracao"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "max-age=60, public"))
                .andExpect(jsonPath("$.modoSomenteLeitura").value(true))
                .andExpect(jsonPath("$.versaoMinimaApp").value("1.0.0"));
    }

    @Test
    void administradorAlteraAConfiguracao() throws Exception {
        when(autenticacao.usuarioIdAtual()).thenReturn(Optional.of("admin-1"));
        when(servico.atualizar(any(ConfiguracaoRemotaRequest.class), eq("admin-1")))
                .thenReturn(new ConfiguracaoRemotaResponse(false, "1.1.0", null));

        mockMvc.perform(put("/api/v1/admin/configuracao").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"modoSomenteLeitura\":false,\"versaoMinimaApp\":\"1.1.0\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.versaoMinimaApp").value("1.1.0"));
    }

    @Test
    void versaoForaDoFormatoEhRecusada() throws Exception {
        mockMvc.perform(put("/api/v1/admin/configuracao").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"modoSomenteLeitura\":false,\"versaoMinimaApp\":\"1.x\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details[0].campo").value("versaoMinimaApp"));

        verifyNoInteractions(servico);
    }

    @Test
    void modoSomenteLeituraEhObrigatorio() throws Exception {
        mockMvc.perform(put("/api/v1/admin/configuracao").contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(servico);
    }

    @Test
    void semUsuarioNoContextoResponde401() throws Exception {
        when(autenticacao.usuarioIdAtual()).thenReturn(Optional.empty());

        mockMvc.perform(put("/api/v1/admin/configuracao").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"modoSomenteLeitura\":true}"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(servico);
    }
}
