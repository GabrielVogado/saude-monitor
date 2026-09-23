package br.com.saude_monitor.api.user.controller;

import br.com.saude_monitor.api.config.exception.NaoAutorizadoException;
import br.com.saude_monitor.api.config.security.AutenticacaoHelper;
import br.com.saude_monitor.api.feedback.dto.FeedbackResponse;
import br.com.saude_monitor.api.feedback.service.FeedbackService;
import br.com.saude_monitor.api.hospital.dto.PageResponse;
import br.com.saude_monitor.api.user.dto.AtualizarConsentimentosRequest;
import br.com.saude_monitor.api.user.dto.ConsentimentosResponse;
import br.com.saude_monitor.api.user.service.ExportacaoPdfService;
import br.com.saude_monitor.api.user.service.UserService;
import br.com.saude_monitor.api.visita.dto.VisitaResponse;
import br.com.saude_monitor.api.visita.service.VisitaService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;

/**
 * Gestão da conta do usuário autenticado — o namespace {@code /api/v1/contas} agrupa
 * tudo que diz respeito ao titular (substitui o antigo {@code /usuarios/me}, F0-05/LGPD).
 *
 * <p>Endpoints autenticados (regra {@code anyRequest().authenticated()} do
 * {@code SecurityConfig}): histórico de visitas e feedbacks, exportação de dados
 * pessoais (art. 18 LGPD), gestão de consentimentos (art. 8º §5º) e exclusão de conta.</p>
 */
@Slf4j
@Validated
@RestController
@RequestMapping("/api/v1/contas")
@RequiredArgsConstructor
public class ContaController {

    private final UserService userService;
    private final AutenticacaoHelper autenticacaoHelper;
    private final VisitaService visitaService;
    private final FeedbackService feedbackService;
    private final ExportacaoPdfService exportacaoPdfService;

    /** Fuso usado para nomear o arquivo exportado, coerente com o restante do produto. */
    private static final ZoneId FUSO_BRASILIA = ZoneId.of("America/Sao_Paulo");

    /** 🔒 Histórico paginado de visitas do usuário (E5-03/RN-22). */
    @GetMapping("/visitas")
    public ResponseEntity<PageResponse<VisitaResponse>> historicoVisitas(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        String usuarioId = exigirUsuarioAutenticado();
        return ResponseEntity.ok(visitaService.historico(usuarioId, page, size));
    }

    /** 🔒 Histórico paginado de feedbacks do usuário (E5-03/RN-22). */
    @GetMapping("/feedbacks")
    public ResponseEntity<PageResponse<FeedbackResponse>> historicoFeedbacks(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        String usuarioId = exigirUsuarioAutenticado();
        return ResponseEntity.ok(feedbackService.historico(usuarioId, page, size));
    }

    /** 🔒 Exportação de dados pessoais em JSON (E5-03 / art. 18 LGPD). */
    @GetMapping("/export")
    public ResponseEntity<Map<String, Object>> exportarDados() {
        String usuarioId = exigirUsuarioAutenticado();
        return ResponseEntity.ok(userService.exportarDados(usuarioId));
    }

    /**
     * 🔒 Exportação de dados pessoais em PDF (E5-03 / art. 18 LGPD).
     *
     * <p>Mesma base de dados do endpoint JSON, porém em documento legível pelo cidadão —
     * é a via acessível do direito de portabilidade para quem não lida com JSON.</p>
     */
    @GetMapping(value = "/export/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> exportarDadosPdf() {
        String usuarioId = exigirUsuarioAutenticado();

        byte[] pdf = exportacaoPdfService.gerar(userService.exportarDados(usuarioId));
        String nomeArquivo = "meus-dados-%s.pdf".formatted(LocalDate.now(FUSO_BRASILIA));

        log.info("Exportação de dados em PDF gerada para o usuário {} (LGPD art. 18).", usuarioId);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + nomeArquivo + "\"")
                .body(pdf);
    }

    /**
     * 🔒 Concede ou revoga consentimentos do titular (E5-05 / art. 8º §5º da LGPD).
     *
     * <p>Aceita atualização parcial: só as finalidades presentes no corpo mudam. A
     * revogação no app é o par lógico da revogação no sistema operacional — o
     * dispositivo deixa de coletar e o backend deixa de ter base legal para tratar.</p>
     */
    @PutMapping("/consentimentos")
    public ResponseEntity<ConsentimentosResponse> atualizarConsentimentos(
            @Valid @RequestBody AtualizarConsentimentosRequest request) {
        String usuarioId = exigirUsuarioAutenticado();
        return ResponseEntity.ok(userService.atualizarConsentimentos(usuarioId, request));
    }

    /**
     * 🔒 Exclui a conta e os dados pessoais do usuário autenticado (F0-05/LGPD).
     * Visitas e feedbacks são anonimizados; agregados públicos são preservados.
     */
    @DeleteMapping("/exclusao")
    public ResponseEntity<Map<String, Object>> excluirConta() {
        String usuarioId = exigirUsuarioAutenticado();

        userService.excluirConta(usuarioId);

        log.info("Conta do usuário {} excluída via endpoint de autogerenciamento (LGPD).", usuarioId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Conta excluída com sucesso. Seus dados pessoais foram removidos."
        ));
    }

    private String exigirUsuarioAutenticado() {
        return autenticacaoHelper.usuarioIdAtual()
                .orElseThrow(() -> new NaoAutorizadoException("Usuário não autenticado."));
    }
}