package br.com.saude_monitor.api.regiao.controller;

import br.com.saude_monitor.api.regiao.TipoCamada;
import br.com.saude_monitor.api.regiao.service.RegiaoService;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

/**
 * Camadas geográficas para o mapa multi-camada (F-11, §5 do plano do painel web).
 *
 * <p>Leitura 100% pública (🔓): divisão administrativa/de saúde não é dado pessoal
 * nem operacional — mesmo regime dos GET de hospitais. {@code Cache-Control} de
 * 1 dia: o dado muda raramente e cada camada pesa até ~440 KB.</p>
 */
@RestController
@RequestMapping("/api/v1/camadas")
@RequiredArgsConstructor
public class RegiaoController {

    private final RegiaoService regiaoService;

    /** 🔓 GeoJSON ({@code FeatureCollection}, RFC 7946, lon/lat) de uma das 4 camadas. */
    @GetMapping(value = "/{tipo}", produces = MediaType.APPLICATION_JSON_VALUE)
    @SecurityRequirements
    public ResponseEntity<String> buscar(@PathVariable String tipo) {
        TipoCamada camada = TipoCamada.fromSlug(tipo);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS))
                .body(regiaoService.buscar(camada));
    }
}
