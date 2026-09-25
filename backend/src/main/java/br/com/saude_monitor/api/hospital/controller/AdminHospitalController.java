package br.com.saude_monitor.api.hospital.controller;

import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import br.com.saude_monitor.api.hospital.dto.HospitalResumoResponse;
import br.com.saude_monitor.api.hospital.dto.PageResponse;
import br.com.saude_monitor.api.hospital.dto.StatusHospital;
import br.com.saude_monitor.api.hospital.service.HospitalService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints administrativos de hospitais (Épico 7 / Painel Admin — F-11).
 *
 * <p>Namespace dedicado {@code /api/v1/admin/**}: separado de propósito do contrato público
 * {@code /api/v1/hospitais} (que permanece só-ativos), para que a autorização a {@code ADMIN}
 * seja declarativa no {@code SecurityConfig} sem colidir com o matcher {@code permitAll} de
 * {@code GET /api/v1/hospitais/**} nem com o path-variable {@code {id}}. Diferentemente dos
 * GET públicos, este controller <strong>não</strong> usa {@code @SecurityRequirements}: o
 * OpenAPI documenta corretamente que exige autenticação/ADMIN.</p>
 */
@RestController
@RequestMapping("/api/v1/admin/hospitais")
@RequiredArgsConstructor
@Validated
public class AdminHospitalController {

    private final HospitalService hospitalService;

    /**
     * 🛡️ Lista hospitais para administração (E7-02), incluindo inativos (E7-07), com
     * filtro por status, tipo, região administrativa (E7-03 — igualdade exata do nome
     * resolvido por point-in-polygon; nomes disponíveis em
     * {@code GET /api/v1/camadas/regiao-administrativa}, propriedade {@code nome}), busca
     * textual e paginação. Sem status, retorna {@link StatusHospital#TODOS}.
     */
    @GetMapping
    public ResponseEntity<PageResponse<HospitalResumoResponse>> listar(
            @RequestParam(required = false) StatusHospital status,
            @RequestParam(required = false) TipoEstabelecimento tipo,
            @RequestParam(required = false) String regiaoAdministrativa,
            @RequestParam(required = false) String busca,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return ResponseEntity.ok(
                hospitalService.listarAdmin(status, tipo, regiaoAdministrativa, busca, page, size));
    }
}
