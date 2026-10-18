package br.com.saude_monitor.api.hospital.controller;

import br.com.saude_monitor.api.hospital.dto.CatalogoResponse;
import br.com.saude_monitor.api.hospital.service.CatalogoService;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * Catálogo público de estabelecimentos (ARQ-01).
 *
 * <p>🔓 Leitura pública, a mesma para qualquer pessoa. O app guarda o catálogo e faz distância,
 * filtro e busca no próprio aparelho; para saber se mudou, reenvia o {@code ETag} em
 * {@code If-None-Match} e recebe 304 sem corpo quando nada mudou (o Spring MVC compara o
 * {@code ETag} da resposta com o cabeçalho da requisição).</p>
 *
 * <p>O {@code ETag} é fraco ({@code W/}) porque o corpo pode sair comprimido (gzip) ou
 * não, conforme o cliente: o que ele garante é o mesmo conteúdo, não os mesmos bytes.</p>
 *
 * <p>{@code Cache-Control}: o aparelho reaproveita por 1 minuto e a borda por 5 minutos
 * ({@code s-maxage}), o mesmo atraso aceito para os dados públicos (P8).</p>
 */
@RestController
@RequestMapping("/api/v1/catalogo")
@RequiredArgsConstructor
public class CatalogoController {

    static final CacheControl CACHE = CacheControl.maxAge(Duration.ofMinutes(1))
            .sMaxAge(CatalogoService.VALIDADE)
            .cachePublic();

    private final CatalogoService catalogoService;

    /** 🔓 Todos os estabelecimentos ativos, com indicadores. */
    @GetMapping
    @SecurityRequirements
    public ResponseEntity<CatalogoResponse> obter() {
        CatalogoResponse catalogo = catalogoService.obter();
        return ResponseEntity.ok()
                .cacheControl(CACHE)
                .eTag("W/\"" + catalogo.versao() + "\"")
                .body(catalogo);
    }
}
