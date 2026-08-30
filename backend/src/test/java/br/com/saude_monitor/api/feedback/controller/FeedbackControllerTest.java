package br.com.saude_monitor.api.feedback.controller;

import br.com.saude_monitor.api.config.exception.GlobalExceptionHandler;
import br.com.saude_monitor.api.config.security.AutenticacaoHelper;
import br.com.saude_monitor.api.feedback.dto.FeedbackRequest;
import br.com.saude_monitor.api.feedback.dto.FeedbackResponse;
import br.com.saude_monitor.api.feedback.service.FeedbackService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.time.Instant;
import java.util.Optional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Testes do {@link FeedbackController} (standalone MockMvc), sem dependência de MongoDB/Security.
 */
class FeedbackControllerTest {

    private final FeedbackService feedbackService = new FeedbackService() {
        private int chamadas = 0;

        @Override
        public FeedbackResponse criar(FeedbackRequest request, String usuarioId) {
            chamadas++;
            return new FeedbackResponse(
                    "fb-1", request.visitaId(), "hosp-1",
                    request.foiAtendido(), null, request.teveMedico(), request.fezTriagem(),
                    request.medicacaoReceita(), request.especialidadeProcurada(), request.nota(),
                    request.tratamentoEquipe(), request.comentario(), usuarioId == null, Instant.now(), true);
        }

        @Override
        public Optional<FeedbackResponse> buscarPorVisita(String visitaId, String usuarioId) {
            return Optional.empty();
        }

        @Override
        public FeedbackResponse atualizar(String id, FeedbackRequest request, String usuarioId) {
            return null;
        }

        @Override
        public void processarSemResposta() {
            // no-op no teste de controller
        }
    };

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders
                .standaloneSetup(new FeedbackController(feedbackService, new AutenticacaoHelper(null)))
                .setValidator(validator)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void deveCriarFeedbackAnonimo() throws Exception {
        String payload = """
                {
                  "visitaId": "visita-1",
                  "foiAtendido": "SIM",
                  "teveMedico": "SIM",
                  "fezTriagem": "SIM",
                  "medicacaoReceita": "RECEBI",
                  "nota": 4,
                  "comentario": "Atendimento rápido."
                }
                """;

        mockMvc.perform(post("/api/v1/feedbacks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("fb-1"))
                .andExpect(jsonPath("$.visitaId").value("visita-1"))
                .andExpect(jsonPath("$.nota").value(4))
                .andExpect(jsonPath("$.recebido").value(true));
    }

    @Test
    void deveRetornar400QuandoNotaAusente() throws Exception {
        String payload = "{\"visitaId\":\"visita-1\"}";

        mockMvc.perform(post("/api/v1/feedbacks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("CAMPOS_INVALIDOS"))
                .andExpect(jsonPath("$.traceId").exists());
    }
}
