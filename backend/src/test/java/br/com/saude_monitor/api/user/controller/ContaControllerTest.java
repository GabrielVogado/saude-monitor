package br.com.saude_monitor.api.user.controller;

import br.com.saude_monitor.api.config.exception.GlobalExceptionHandler;
import br.com.saude_monitor.api.config.security.AutenticacaoHelper;
import br.com.saude_monitor.api.feedback.dto.FeedbackResponse;
import br.com.saude_monitor.api.feedback.service.FeedbackService;
import br.com.saude_monitor.api.hospital.dto.PageResponse;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.repository.UserRepository;
import br.com.saude_monitor.api.user.service.ExportacaoPdfService;
import br.com.saude_monitor.api.user.service.UserService;
import br.com.saude_monitor.api.visita.dto.VisitaResponse;
import br.com.saude_monitor.api.visita.service.VisitaService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import org.springframework.http.MediaType;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Testes do {@link ContaController} (standalone MockMvc) — contas do titular:
 * histórico de visitas/feedbacks, exportação (LGPD), gestão de consentimentos
 * (E5-05) e exclusão.
 */
class ContaControllerTest {

    private final UserService userService = new UserService() {
        @Override
        public br.com.saude_monitor.api.user.dto.UserResponse saveUser(
                br.com.saude_monitor.api.user.dto.UserRequest request) {
            return null;
        }

        @Override
        public br.com.saude_monitor.api.user.dto.ConsentimentosResponse atualizarConsentimentos(
                String usuarioId, br.com.saude_monitor.api.user.dto.AtualizarConsentimentosRequest request) {
            var agora = java.time.Instant.parse("2026-09-01T12:00:00Z");
            return new br.com.saude_monitor.api.user.dto.ConsentimentosResponse(
                    new br.com.saude_monitor.api.user.dto.ConsentimentosResponse.Finalidade(
                            Boolean.TRUE.equals(request.localizacao()), agora, "1.0"),
                    new br.com.saude_monitor.api.user.dto.ConsentimentosResponse.Finalidade(
                            Boolean.TRUE.equals(request.notificacoes()), agora, "1.0"),
                    new br.com.saude_monitor.api.user.dto.ConsentimentosResponse.Finalidade(true, agora, "1.0"));
        }

        @Override
        public Map<String, Object> exportarDados(String usuarioId) {
            return Map.of(
                    "geradoEm", "2026-08-31T00:00:00Z",
                    "usuario", Map.of("nome", "Marina Souza", "email", "marina@email.com")
            );
        }

        @Override
        public void excluirConta(String usuarioId) {
            // no-op no teste de controller
        }
    };

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByEmail("marina@email.com"))
                .thenReturn(Optional.of(UserDocument.builder().id("u1").build()));

        VisitaService visitaService = mock(VisitaService.class);
        when(visitaService.historico("u1", 0, 20))
                .thenReturn(PageResponse.of(List.<VisitaResponse>of(), 0, 20, 0));

        FeedbackService feedbackService = mock(FeedbackService.class);
        when(feedbackService.historico("u1", 0, 20))
                .thenReturn(PageResponse.of(List.<FeedbackResponse>of(), 0, 20, 0));

        // O conteúdo do documento é coberto em ExportacaoPdfServiceImplTest;
        // aqui interessa apenas o contrato HTTP do endpoint.
        ExportacaoPdfService exportacaoPdfService = mock(ExportacaoPdfService.class);
        when(exportacaoPdfService.gerar(org.mockito.ArgumentMatchers.anyMap()))
                .thenReturn("%PDF-1.4".getBytes(java.nio.charset.StandardCharsets.ISO_8859_1));

        authenticateAs("marina@email.com");

        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders
                .standaloneSetup(new ContaController(userService, new AutenticacaoHelper(userRepository),
                        visitaService, feedbackService, exportacaoPdfService))
                .setValidator(validator)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void authenticateAs(String email) {
        User principal = new User(email, "", List.of(new SimpleGrantedAuthority("ROLE_USER")));
        SecurityContextHolder.getContext()
                .setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    @Test
    void deveListarHistoricoDeVisitas() throws Exception {
        mockMvc.perform(get("/api/v1/contas/visitas")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    void deveListarHistoricoDeFeedbacks() throws Exception {
        mockMvc.perform(get("/api/v1/contas/feedbacks")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    void deveExportarDadosPessoais() throws Exception {
        mockMvc.perform(get("/api/v1/contas/export"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.usuario.email").value("marina@email.com"));
    }

    @Test
    void deveExportarDadosPessoaisEmPdf() throws Exception {
        mockMvc.perform(get("/api/v1/contas/export/pdf"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.startsWith("attachment; filename=\"meus-dados-")));
    }

    @Test
    void deveNegarExportacaoEmPdfSemAutenticacao() throws Exception {
        SecurityContextHolder.clearContext();

        mockMvc.perform(get("/api/v1/contas/export/pdf"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deveExcluirConta() throws Exception {
        mockMvc.perform(delete("/api/v1/contas/exclusao"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void deveRevogarConsentimentoDeLocalizacao() throws Exception {
        mockMvc.perform(put("/api/v1/contas/consentimentos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"localizacao": false, "versaoTermos": "1.0"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.localizacao.aceito").value(false))
                .andExpect(jsonPath("$.localizacao.versao").value("1.0"));
    }

    @Test
    void deveNegarAtualizacaoDeConsentimentosSemAutenticacao() throws Exception {
        SecurityContextHolder.clearContext();

        mockMvc.perform(put("/api/v1/contas/consentimentos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"notificacoes": true}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("NAO_AUTORIZADO"));
    }

    @Test
    void deveRetornar401SemAutenticacao() throws Exception {
        SecurityContextHolder.clearContext();

        mockMvc.perform(get("/api/v1/contas/visitas"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("NAO_AUTORIZADO"));
    }
}