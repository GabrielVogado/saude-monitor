package br.com.saude_monitor.api.auth.email;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Propriedades de configuração do Resend (envio de e-mail transacional), lidas do
 * prefixo {@code app.resend}. Registrada automaticamente pelo {@code @ConfigurationPropertiesScan}.
 */
@ConfigurationProperties(prefix = "app.resend")
public record ResendProperties(
        /** API key do Resend. Sobrescrever via {@code RESEND_API_KEY} em produção. */
        String apiKey,
        /** Remetente ({@code Nome <email@dominio>}). Sem domínio verificado no Resend, só
         *  entrega para o e-mail da própria conta (sandbox). */
        String remetente
) {
}
