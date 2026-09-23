package br.com.saude_monitor.api.config.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Propriedades de configuração do JWT, lidas do prefixo {@code app.jwt}.
 *
 * <p>Registrada automaticamente pelo {@code @ConfigurationPropertiesScan} na aplicação.</p>
 */
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(
        /** Chave HMAC (>= 32 bytes para HS256). Sobrescrever via {@code JWT_SECRET} em produção. */
        String secret,
        /** Validade do access token em milissegundos (padrão 15 min). */
        long accessExpirationMs,
        /** Validade do refresh token em milissegundos (padrão 30 dias). */
        long refreshExpirationMs
) {
}
