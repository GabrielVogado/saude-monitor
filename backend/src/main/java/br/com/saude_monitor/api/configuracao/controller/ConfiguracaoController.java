package br.com.saude_monitor.api.configuracao.controller;

import br.com.saude_monitor.api.configuracao.dto.ConfiguracaoRemotaResponse;
import br.com.saude_monitor.api.configuracao.service.ConfiguracaoRemotaService;
import br.com.saude_monitor.api.hospital.service.CatalogoService;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * Configuração remota pública (ARQ-09), lida pelo app ao abrir e ao voltar ao primeiro plano.
 *
 * <p>🔓 A mesma para qualquer pessoa. {@code Cache-Control} de 1 minuto no aparelho e na
 * borda: somado à releitura de 30 s de cada instância, uma alteração chega ao app em até
 * cerca de 1 minuto e meio.</p>
 *
 * <p>Leva também a versão do catálogo de estabelecimentos. É o aviso de que a lista mudou:
 * o app só baixa o catálogo quando essa versão difere da cópia dele, em vez de conferir com o
 * servidor de tempos em tempos.</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/configuracao")
@RequiredArgsConstructor
public class ConfiguracaoController {

    static final CacheControl CACHE = CacheControl.maxAge(Duration.ofMinutes(1)).cachePublic();

    private final ConfiguracaoRemotaService configuracaoRemotaService;
    private final CatalogoService catalogoService;

    /** 🔓 Modo somente leitura, versão mínima do app, mensagem de manutenção e versão do catálogo. */
    @GetMapping
    @SecurityRequirements
    public ResponseEntity<ConfiguracaoRemotaResponse> obterConfiguracao() {
        ConfiguracaoRemotaResponse configuracao = configuracaoRemotaService.obterConfiguracao()
                .comVersaoCatalogo(obterVersaoCatalogo());
        return ResponseEntity.ok().cacheControl(CACHE).body(configuracao);
    }

    /**
     * Versão do catálogo, ou {@code null} se ela não pôde ser montada agora (banco fora, dado
     * inesperado): a configuração (versão mínima, modo somente leitura) não pode deixar de
     * chegar por causa do catálogo.
     */
    private String obterVersaoCatalogo() {
        try {
            return catalogoService.obterCatalogo().versao();
        } catch (RuntimeException e) {
            log.warn("Configuração remota sem a versão do catálogo: {}", e.getMessage());
            return null;
        }
    }
}
