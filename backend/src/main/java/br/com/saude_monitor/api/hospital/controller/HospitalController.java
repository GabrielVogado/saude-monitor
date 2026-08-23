package br.com.saude_monitor.api.hospital.controller;

import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import br.com.saude_monitor.api.hospital.dto.AlterarStatusRequest;
import br.com.saude_monitor.api.hospital.dto.GeoJsonPolygonDto;
import br.com.saude_monitor.api.hospital.dto.HospitalRequest;
import br.com.saude_monitor.api.hospital.dto.HospitalResumoResponse;
import br.com.saude_monitor.api.hospital.dto.HospitalResponse;
import br.com.saude_monitor.api.hospital.dto.PageResponse;
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
}
