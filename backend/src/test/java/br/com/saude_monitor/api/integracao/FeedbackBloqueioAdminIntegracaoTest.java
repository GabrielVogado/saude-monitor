package br.com.saude_monitor.api.integracao;

import br.com.saude_monitor.api.config.security.JwtService;
import br.com.saude_monitor.api.feedback.repository.FeedbackRepository;
import br.com.saude_monitor.api.user.document.Papel;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Bloqueio de escrita sobre feedback para o papel ADMIN (E7-08, RN-19).
 *
 * <p>A posse do feedback já é exigida no serviço (RN-09), então um ADMIN nunca editou o
 * feedback de outra pessoa. O caso que só a regra do {@code SecurityConfig} fecha é o do
 * feedback <strong>da própria conta ADMIN</strong>: sem ela, o PUT passaria pela checagem
 * de dono e gravaria. Contexto Spring completo de propósito, pelo mesmo motivo do
 * {@link AdminHospitalListagemIntegracaoTest}: a decisão vive no filtro de segurança real.</p>
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.geofence.reconciliacao.enabled=false")
class FeedbackBloqueioAdminIntegracaoTest extends IntegracaoTestBase {

    @Container
    static final MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", mongo::getReplicaSetUrl);
    }

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FeedbackRepository feedbackRepository;

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
                .emailVerificado(true)
                .build());
        return jwtService.generateAccessToken(usuario);
    }

    private record FeedbackCriado(String visitaId, String feedbackId) {
    }

    /** Visita finalizada do dono do {@code token}, com feedback de nota 3. */
    private FeedbackCriado feedbackDe(String token) throws Exception {
        String respostaCheckin = mockMvc.perform(post("/api/v1/visitas/checkin")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "hospitalId": "%s", "origem": "MANUAL" }
                                """.formatted(hospitalAtivo())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String visitaId = objectMapper.readTree(respostaCheckin).get("id").asText();

        mockMvc.perform(post("/api/v1/visitas/" + visitaId + "/checkout")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());

        String respostaFeedback = mockMvc.perform(post("/api/v1/feedbacks")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "visitaId": "%s", "nota": 3 }
                                """.formatted(visitaId)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return new FeedbackCriado(visitaId, objectMapper.readTree(respostaFeedback).get("id").asText());
    }

    private String edicaoNota5(String visitaId) {
        return """
                { "visitaId": "%s", "nota": 5, "comentario": "alterado" }
                """.formatted(visitaId);
    }

    @Test
    void adminNaoEditaNemOProprioFeedback() throws Exception {
        String tokenAdmin = token(Papel.ADMIN, "admin-feedback@saude-teste.com");
        FeedbackCriado criado = feedbackDe(tokenAdmin);
        String feedbackId = criado.feedbackId();

        mockMvc.perform(put("/api/v1/feedbacks/" + feedbackId)
                        .header("Authorization", "Bearer " + tokenAdmin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(edicaoNota5(criado.visitaId())))
                .andExpect(status().isForbidden());

        assertThat(feedbackRepository.findById(feedbackId).orElseThrow().getNota()).isEqualTo(3);
    }

    @Test
    void adminNaoEditaFeedbackDeUsuarioEODonoContinuaEditando() throws Exception {
        String tokenUsuario = token(Papel.USER, "dono-e708@saude-teste.com");
        String tokenAdmin = token(Papel.ADMIN, "admin-e708@saude-teste.com");
        FeedbackCriado criado = feedbackDe(tokenUsuario);
        String feedbackId = criado.feedbackId();

        mockMvc.perform(put("/api/v1/feedbacks/" + feedbackId)
                        .header("Authorization", "Bearer " + tokenAdmin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(edicaoNota5(criado.visitaId())))
                .andExpect(status().isForbidden());
        assertThat(feedbackRepository.findById(feedbackId).orElseThrow().getNota()).isEqualTo(3);

        // A regra não pode custar a edição do dono dentro da janela de 24h (RN-09).
        mockMvc.perform(put("/api/v1/feedbacks/" + feedbackId)
                        .header("Authorization", "Bearer " + tokenUsuario)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(edicaoNota5(criado.visitaId())))
                .andExpect(status().isOk());
        assertThat(feedbackRepository.findById(feedbackId).orElseThrow().getNota()).isEqualTo(5);
    }
}
