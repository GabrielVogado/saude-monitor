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
 * <p>Os raios de geofence por categoria (HOSPITAL 150 m · UBS 75 m · demais 100 m) são a
 * fonte da verdade do raio em todo o sistema: além de valer para o que este seed cria, o
 * {@link ReconciliacaoRaioGeofenceRunner} regrava com eles, no startup, os geofences já
 * gravados no banco. Os valores originais (HOSPITAL 200 · UPA 150 · UBS 100 · demais 150)
 * vinham do pipeline ETL de referência e cobriam a vizinhança do estabelecimento — ver
 * BUG-08 e o comentário no {@code application.properties}. A antiga referência à
 * "Especificação §3.6" era órfã: aquela seção trata do namespace {@code contas}, e nenhum
 * documento ativo fixa raio de geofence.</p>
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
