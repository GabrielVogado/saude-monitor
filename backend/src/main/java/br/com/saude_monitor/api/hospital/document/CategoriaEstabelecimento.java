package br.com.saude_monitor.api.hospital.document;

/**
 * Categoria assistencial do estabelecimento.
 *
 * <p>Extensão do Épico 01 para suportar a importação de dados do CNES
 * (Hospitais, UPAs e UBS de Brasília-DF). Diferencia a natureza do serviço
 * de saúde, enquanto {@link TipoEstabelecimento} expressa a natureza
 * administrativa (público/privado/filantrópico).</p>
 */
public enum CategoriaEstabelecimento {
    HOSPITAL,
    UPA,
    UBS,
    POLICLINICA,
    CAPS,
    CENTRO_ESPECIALIZADO,
    OUTRO
}
