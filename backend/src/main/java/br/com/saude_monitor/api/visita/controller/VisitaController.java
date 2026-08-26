package br.com.saude_monitor.api.visita.controller;

import br.com.saude_monitor.api.config.exception.NaoAutorizadoException;
import br.com.saude_monitor.api.config.security.AutenticacaoHelper;
import br.com.saude_monitor.api.hospital.dto.PageResponse;
import br.com.saude_monitor.api.visita.dto.CheckinRequest;
import br.com.saude_monitor.api.visita.dto.CheckinResponse;
import br.com.saude_monitor.api.visita.dto.CheckoutRequest;
import br.com.saude_monitor.api.visita.dto.CheckoutResponse;
import br.com.saude_monitor.api.visita.dto.HeartbeatResponse;
import br.com.saude_monitor.api.visita.dto.TipoPermanenciaRequest;
import br.com.saude_monitor.api.visita.dto.TipoPermanenciaResponse;
import br.com.saude_monitor.api.visita.dto.VisitaAtivaResponse;
import br.com.saude_monitor.api.visita.dto.VisitaResponse;
import br.com.saude_monitor.api.visita.service.VisitaService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints de visitas (Épico 02 — Detecção de Visitas/Geofence), §3.3 da Especificação da API.
 *
 * <p>Legenda: 🔓 público (anônimo, via {@code dispositivoId}) · 🔒 autenticado · 🛡️ admin/job interno.</p>
 */
@RestController
@RequiredArgsConstructor
@Validated
public class VisitaController {

    private final VisitaService visitaService;
    private final AutenticacaoHelper autenticacaoHelper;

    /** 🔓/🔒 Registra entrada (E2-01/E2-06); anônima quando não autenticado e com dispositivoId. */
    @PostMapping("/api/v1/visitas/checkin")
    public ResponseEntity<CheckinResponse> checkin(@Valid @RequestBody CheckinRequest request) {
        String usuarioId = autenticacaoHelper.usuarioIdAtual().orElse(null);
        return ResponseEntity.status(HttpStatus.CREATED).body(visitaService.checkin(request, usuarioId));
    }

    /** 🔓/🔒 Registra saída (E2-02/E2-05). */
    @PostMapping("/api/v1/visitas/{id}/checkout")
    public ResponseEntity<CheckoutResponse> checkout(@PathVariable String id,
                                                      @Valid @RequestBody CheckoutRequest request) {
        String usuarioId = autenticacaoHelper.usuarioIdAtual().orElse(null);
        return ResponseEntity.ok(visitaService.checkout(id, request, usuarioId));
    }

    /** 🔓/🔒 Sinal de vida da visita ativa (E2-09). */
    @PostMapping("/api/v1/visitas/{id}/heartbeat")
    public ResponseEntity<HeartbeatResponse> heartbeat(@PathVariable String id) {
        String usuarioId = autenticacaoHelper.usuarioIdAtual().orElse(null);
        return ResponseEntity.ok(visitaService.heartbeat(id, usuarioId));
    }

    /** 🔒 Sinaliza observação/internação após 12h de visita ativa (E2-10). */
    @PatchMapping("/api/v1/visitas/{id}/tipo-permanencia")
    public ResponseEntity<TipoPermanenciaResponse> sinalizarTipoPermanencia(
            @PathVariable String id, @Valid @RequestBody TipoPermanenciaRequest request) {
        String usuarioId = exigirUsuarioAutenticado();
        return ResponseEntity.ok(visitaService.sinalizarTipoPermanencia(id, request, usuarioId));
    }

    /** 🔒 Visita ativa do usuário, para o card/cronômetro (E2-07). */
    @GetMapping("/api/v1/visitas/ativas")
    public ResponseEntity<VisitaAtivaResponse> buscarAtiva() {
        String usuarioId = exigirUsuarioAutenticado();
        return ResponseEntity.ok(visitaService.buscarAtiva(usuarioId));
    }

    /** 🔒 Histórico paginado de visitas do usuário. */
    @GetMapping("/api/v1/usuarios/me/visitas")
    public ResponseEntity<PageResponse<VisitaResponse>> historico(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        String usuarioId = exigirUsuarioAutenticado();
        return ResponseEntity.ok(visitaService.historico(usuarioId, page, size));
    }

    private String exigirUsuarioAutenticado() {
        return autenticacaoHelper.usuarioIdAtual()
                .orElseThrow(() -> new NaoAutorizadoException("Usuário não autenticado."));
    }
}
