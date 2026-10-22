package br.com.saude_monitor.api.hospital.controller;

import br.com.saude_monitor.api.hospital.dto.CatalogoResponse;
import br.com.saude_monitor.api.hospital.dto.IndicadoresCatalogoResponse;
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
 * filtro e busca no próprio aparelho. Ele sabe que o catálogo mudou pelo {@code versaoCatalogo}
 * da configuração remota e, ao baixar, reenvia o {@code ETag} em {@code If-None-Match}: recebe
 * 304 sem corpo quando nada mudou (o Spring MVC compara o {@code ETag} da resposta com o
 * cabeçalho da requisição).</p>
 *
 * <p>Nota e tempo de cada estabelecimento ficam em {@code GET /api/v1/catalogo/indicadores},
 * porque mudam a cada avaliação.</p>
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

    /** 🔓 Todos os estabelecimentos ativos, sem indicadores. */
    @GetMapping
    @SecurityRequirements
    public ResponseEntity<CatalogoResponse> obterCatalogo() {
        CatalogoResponse catalogo = catalogoService.obterCatalogo();
        return ResponseEntity.ok()
                .cacheControl(CACHE)
                .eTag(montarETag(catalogo.versao()))
                .body(catalogo);
    }

    /** 🔓 Nota e tempo de todos os estabelecimentos ativos, por id do hospital. */
    @GetMapping("/indicadores")
    @SecurityRequirements
    public ResponseEntity<IndicadoresCatalogoResponse> obterIndicadores() {
        IndicadoresCatalogoResponse indicadores = catalogoService.obterIndicadores();
        return ResponseEntity.ok()
                .cacheControl(CACHE)
                .eTag(montarETag(indicadores.versao()))
                .body(indicadores);
    }

    private static String montarETag(String versao) {
        return "W/\"" + versao + "\"";
    }
}
