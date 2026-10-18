package br.com.saude_monitor.api.configuracao.controller;

import br.com.saude_monitor.api.configuracao.dto.ConfiguracaoRemotaResponse;
import br.com.saude_monitor.api.configuracao.service.ConfiguracaoRemotaService;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * Configuração remota pública (ARQ-09), lida pelo app ao abrir.
 *
 * <p>🔓 A mesma para qualquer pessoa. {@code Cache-Control} de 1 minuto no aparelho e na
 * borda: somado à releitura de 30 s de cada instância, uma alteração chega ao app em até
 * cerca de 1 minuto e meio.</p>
 */
@RestController
@RequestMapping("/api/v1/configuracao")
@RequiredArgsConstructor
public class ConfiguracaoController {

    static final CacheControl CACHE = CacheControl.maxAge(Duration.ofMinutes(1)).cachePublic();

    private final ConfiguracaoRemotaService configuracaoRemotaService;

    /** 🔓 Modo somente leitura, versão mínima do app e mensagem de manutenção. */
    @GetMapping
    @SecurityRequirements
    public ResponseEntity<ConfiguracaoRemotaResponse> obter() {
        return ResponseEntity.ok().cacheControl(CACHE).body(configuracaoRemotaService.obter());
    }
}
