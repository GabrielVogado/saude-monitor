package br.com.saude_monitor.api.hospital.seed;

import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuração do seed de estabelecimentos de saúde a partir de arquivos DBF/SHP.
 *
 * <p>Valores padrão declarados em {@code application.properties} (prefixo {@code app.seed}).
 * O seed é habilitado por padrão e, no modo {@code skip-if-not-empty}, só popula o banco
 * quando a coleção {@code hospitais} está vazia — tornando a inicialização idempotente em
 * qualquer ambiente/máquina.</p>
 *
 * <p>Os raios de geofence por categoria espelham a Especificação (§3.6) e o pipeline
 * ETL de referência (HOSPITAL 200 m · UPA 150 m · UBS 100 m · demais 150 m).</p>
 */
@ConfigurationProperties(prefix = "app.seed")
public record SeedProperties(
        boolean enabled,
        String path,
        String codepage,
        String modo,
        String lote,
        double toleranciaBbox,
        double raioHospital,
        double raioUpa,
        double raioUbs,
        double raioPoliclinica,
        double raioCaps,
        double raioCentroEspecializado,
        double raioOutro
) {

    /** Raio do geofence circular (metros) conforme a categoria assistencial. */
    public double raio(CategoriaEstabelecimento categoria) {
        return switch (categoria) {
            case HOSPITAL -> raioHospital;
            case UPA -> raioUpa;
            case UBS -> raioUbs;
            case POLICLINICA -> raioPoliclinica;
            case CAPS -> raioCaps;
            case CENTRO_ESPECIALIZADO -> raioCentroEspecializado;
            case OUTRO -> raioOutro;
        };
    }

    /** Modo {@code upsert} força a re-importação mesmo com a coleção já populada. */
    public boolean upsert() {
        return "upsert".equalsIgnoreCase(modo);
    }
}
