package br.com.saude_monitor.api.hospital.controller;

import br.com.saude_monitor.api.agregado.dto.IndicadoresDetalheResponse;
import br.com.saude_monitor.api.agregado.service.AgregadoService;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import br.com.saude_monitor.api.config.security.AutenticacaoHelper;
import br.com.saude_monitor.api.hospital.document.StatusSugestao;
import br.com.saude_monitor.api.hospital.dto.AlterarStatusRequest;
import br.com.saude_monitor.api.hospital.dto.AprovarSugestaoRequest;
import br.com.saude_monitor.api.hospital.dto.GeoJsonPolygonDto;
import br.com.saude_monitor.api.hospital.dto.HospitalRequest;
import br.com.saude_monitor.api.hospital.dto.HospitalResumoResponse;
import br.com.saude_monitor.api.hospital.dto.HospitalResponse;
import br.com.saude_monitor.api.hospital.dto.PageResponse;
import br.com.saude_monitor.api.hospital.dto.RejeitarSugestaoRequest;
import br.com.saude_monitor.api.hospital.dto.SugestaoHospitalDetalheResponse;
import br.com.saude_monitor.api.hospital.dto.SugestaoHospitalRequest;
import br.com.saude_monitor.api.hospital.dto.SugestaoHospitalResponse;
import br.com.saude_monitor.api.hospital.service.HospitalService;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints de hospitais (Épico 01).
 *
 * <p>Legenda de segurança: 🔓 público · 🛡️ admin. A proteção dos endpoints de escrita
 * (POST/PUT/PATCH) é responsabilidade da Fase 0 (Spring Security + JWT + papel {@code ADMIN}),
 * fora do escopo do Épico 01. Os endpoints estão implementados e prontos para receber a
 * regra de autorização quando a Fase 0 for concluída.</p>
 */
@RestController
@RequestMapping("/api/v1/hospitais")
@RequiredArgsConstructor
@Validated
public class HospitalController {

    private final HospitalService hospitalService;
    private final AutenticacaoHelper autenticacaoHelper;
    private final AgregadoService agregadoService;

    /** 🔓 Lista hospitais ativos, com filtro geoespacial (raio), tipo e busca textual. */
    @GetMapping
    public ResponseEntity<PageResponse<HospitalResumoResponse>> listar(
            @RequestParam(required = false) Double latitude,
            @RequestParam(required = false) Double longitude,
            @RequestParam(required = false) Double raioKm,
            @RequestParam(required = false) TipoEstabelecimento tipo,
            @RequestParam(required = false) String busca,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return ResponseEntity.ok(hospitalService.listar(latitude, longitude, raioKm, tipo, busca, page, size));
    }

    /** 🔓 Detalhe público do hospital. */
    @GetMapping("/{id}")
    public ResponseEntity<HospitalResponse> buscarPorId(@PathVariable String id) {
        return ResponseEntity.ok(hospitalService.buscarPorId(id));
    }

    /** 🔓 Retorna apenas o geofence, para renderização no mapa. */
    @GetMapping("/{id}/geofence")
    public ResponseEntity<GeoJsonPolygonDto> buscarGeofence(@PathVariable String id) {
        return ResponseEntity.ok(hospitalService.buscarGeofence(id));
    }

    /**
     * 🔓 Indicadores públicos enriquecidos do hospital (§3.5 / E4-01..E4-04).
     * 404 se o hospital não existir; 200 com {@code indicadoresDisponiveis=false}
     * quando ainda não há amostra suficiente (RN-15).
     */
    @GetMapping("/{id}/indicadores")
    public ResponseEntity<IndicadoresDetalheResponse> buscarIndicadores(@PathVariable String id) {
        IndicadoresDetalheResponse detalhe = agregadoService.obterDetalhe(id);
        if (detalhe == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(detalhe);
    }

    /** 🛡️ Cadastro de hospital + geofence (admin). */
    @PostMapping
    public ResponseEntity<HospitalResponse> criar(@Valid @RequestBody HospitalRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(hospitalService.criar(request));
    }

    /** 🛡️ Atualização completa do hospital/geofence (admin). */
    @PutMapping("/{id}")
    public ResponseEntity<HospitalResponse> atualizar(@PathVariable String id,
                                                      @Valid @RequestBody HospitalRequest request) {
        return ResponseEntity.ok(hospitalService.atualizar(id, request));
    }

    /** 🛡️ Ativa/desativa o hospital (admin). */
    @PatchMapping("/{id}/status")
    public ResponseEntity<HospitalResponse> alterarStatus(@PathVariable String id,
                                                          @Valid @RequestBody AlterarStatusRequest request) {
        return ResponseEntity.ok(hospitalService.alterarStatus(id, request.ativo()));
    }

    /** 🔓 Sugestão pública de hospital ainda não cadastrado (E1-05, P2). */
    @PostMapping("/sugestoes")
    public ResponseEntity<SugestaoHospitalResponse> sugerir(@Valid @RequestBody SugestaoHospitalRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(hospitalService.sugerir(request));
    }

    /** 🛡️ Lista sugestões públicas, filtrável por status (E1-06). */
    @GetMapping("/sugestoes")
    public ResponseEntity<PageResponse<SugestaoHospitalDetalheResponse>> listarSugestoes(
            @RequestParam(required = false) StatusSugestao status,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return ResponseEntity.ok(hospitalService.listarSugestoes(status, page, size));
    }

    /** 🛡️ Detalhe de uma sugestão pública (E1-06). */
    @GetMapping("/sugestoes/{id}")
    public ResponseEntity<SugestaoHospitalDetalheResponse> buscarSugestaoPorId(@PathVariable String id) {
        return ResponseEntity.ok(hospitalService.buscarSugestaoPorId(id));
    }

    /** 🛡️ Aprova uma sugestão pendente, vinculando-a a um hospital oficial (E1-06). */
    @PostMapping("/sugestoes/{id}/aprovar")
    public ResponseEntity<SugestaoHospitalDetalheResponse> aprovarSugestao(
            @PathVariable String id,
            @Valid @RequestBody AprovarSugestaoRequest request) {
        String adminId = autenticacaoHelper.usuarioIdAtual()
                .orElseThrow(() -> new br.com.saude_monitor.api.config.exception.NaoAutorizadoException(
                        "Usuário não autenticado."));
        return ResponseEntity.ok(hospitalService.aprovarSugestao(id, request, adminId));
    }

    /** 🛡️ Rejeita uma sugestão pendente, exigindo motivo (E1-06). */
    @PostMapping("/sugestoes/{id}/rejeitar")
    public ResponseEntity<SugestaoHospitalDetalheResponse> rejeitarSugestao(
            @PathVariable String id,
            @Valid @RequestBody RejeitarSugestaoRequest request) {
        String adminId = autenticacaoHelper.usuarioIdAtual()
                .orElseThrow(() -> new br.com.saude_monitor.api.config.exception.NaoAutorizadoException(
                        "Usuário não autenticado."));
        return ResponseEntity.ok(hospitalService.rejeitarSugestao(id, request, adminId));
    }
}
