package br.com.saude_monitor.api.feedback.controller;

import br.com.saude_monitor.api.config.exception.NaoAutorizadoException;
import br.com.saude_monitor.api.config.security.AutenticacaoHelper;
import br.com.saude_monitor.api.feedback.dto.FeedbackRequest;
import br.com.saude_monitor.api.feedback.dto.FeedbackResponse;
import br.com.saude_monitor.api.feedback.service.FeedbackService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

/**
 * Endpoints de feedback pós-saída (Épico 03 / F-05), §3.4 da Especificação da API.
 *
 * <p>Legenda: 🔓 público (anônimo, sem login — RN-20) · 🔒 autenticado (dono).</p>
 */
@RestController
@RequiredArgsConstructor
@Validated
public class FeedbackController {

    private final FeedbackService feedbackService;
    private final AutenticacaoHelper autenticacaoHelper;

    /** 🔓/🔒 Cria feedback pós-saída; autenticação opcional (anônimo, RN-13). */
    @PostMapping("/api/v1/feedbacks")
    public ResponseEntity<FeedbackResponse> criar(@Valid @RequestBody FeedbackRequest request) {
        String usuarioId = autenticacaoHelper.usuarioIdAtual().orElse(null);
        return ResponseEntity.status(HttpStatus.CREATED).body(feedbackService.criar(request, usuarioId));
    }

    /** 🔒 Feedback da visita (dono), para edição de comentário (RN-09). */
    @GetMapping("/api/v1/visitas/{id}/feedback")
    public ResponseEntity<FeedbackResponse> buscarPorVisita(@PathVariable String id) {
        String usuarioId = exigirUsuarioAutenticado();
        Optional<FeedbackResponse> feedback = feedbackService.buscarPorVisita(id, usuarioId);
        return feedback.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    /** 🔒 Edita feedback dentro da janela de 24h (dono, RN-09). */
    @PutMapping("/api/v1/feedbacks/{id}")
    public ResponseEntity<FeedbackResponse> atualizar(@PathVariable String id,
                                                      @Valid @RequestBody FeedbackRequest request) {
        String usuarioId = exigirUsuarioAutenticado();
        return ResponseEntity.ok(feedbackService.atualizar(id, request, usuarioId));
    }

    private String exigirUsuarioAutenticado() {
        return autenticacaoHelper.usuarioIdAtual()
                .orElseThrow(() -> new NaoAutorizadoException("Usuário não autenticado."));
    }
}
