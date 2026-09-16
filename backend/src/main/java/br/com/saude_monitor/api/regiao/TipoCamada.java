package br.com.saude_monitor.api.regiao;

import br.com.saude_monitor.api.config.exception.RecursoNaoEncontradoException;

/**
 * Camadas geográficas servidas em {@code GET /api/v1/camadas/{tipo}} (F-11, §5 do
 * {@code Plano-Tecnico-Painel-Administrativo-Web-v1.0.md}).
 *
 * <p>Slugs idênticos aos do plano (§5.1): {@code regiao-administrativa} | {@code ride} |
 * {@code regiao-saude} | {@code macrorregiao-saude}. Slug fora dessa lista cai no
 * envelope 404 padrão ({@code RECURSO_NAO_ENCONTRADO}), não em 400 — do ponto de vista
 * do cliente, é um recurso que não existe.</p>
 */
public enum TipoCamada {

    REGIAO_ADMINISTRATIVA("regiao-administrativa", "camadas/regiao-administrativa.geojson"),
    RIDE("ride", "camadas/ride.geojson"),
    REGIAO_SAUDE("regiao-saude", "camadas/regiao-saude.geojson"),
    MACRORREGIAO_SAUDE("macrorregiao-saude", "camadas/macrorregiao-saude.geojson");

    private final String slug;
    private final String recursoClasspath;

    TipoCamada(String slug, String recursoClasspath) {
        this.slug = slug;
        this.recursoClasspath = recursoClasspath;
    }

    public String slug() {
        return slug;
    }

    public String recursoClasspath() {
        return recursoClasspath;
    }

    public static TipoCamada fromSlug(String slug) {
        for (TipoCamada tipo : values()) {
            if (tipo.slug.equals(slug)) {
                return tipo;
            }
        }
        throw new RecursoNaoEncontradoException("Camada geográfica desconhecida: " + slug);
    }
}
