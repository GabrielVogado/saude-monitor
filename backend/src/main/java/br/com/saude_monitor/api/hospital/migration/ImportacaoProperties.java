package br.com.saude_monitor.api.hospital.migration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuração da importação de estabelecimentos de saúde.
 *
 * <p>Valores padrão são definidos em {@code application.properties}. A importação é
 * desabilitada por padrão ({@code enabled=false}) e ativada explicitamente quando um
 * arquivo de dados estiver disponível.</p>
 */
@ConfigurationProperties(prefix = "app.importacao.estabelecimentos")
public record ImportacaoProperties(
        boolean enabled,
        String caminhoArquivo,
        String formato,
        double raioGeofenceMetros,
        String ufPadrao
) {
}
