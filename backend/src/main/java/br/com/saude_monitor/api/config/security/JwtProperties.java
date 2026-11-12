package br.com.saude_monitor.api.config.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Propriedades de configuração do JWT, lidas do prefixo {@code app.jwt}.
 *
 * <p>Registrada automaticamente pelo {@code @ConfigurationPropertiesScan} na aplicação.</p>
 *
 * <p>Rotação de chave (SEG-04): {@code chaves} traz as chaves com identificador ({@code kid}) e
 * {@code chaveAtiva} diz qual delas assina os tokens novos; as outras só validam. {@code secret}
 * é a chave legada, sem {@code kid}, que assina enquanto não houver chave ativa e valida os
 * tokens emitidos antes da primeira rotação. Regras e erros de configuração em {@link ChavesJwt}.</p>
 */
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(
        /** Chave legada, sem kid (>= 32 bytes). Sobrescrever via {@code JWT_SECRET} em produção. */
        String secret,
        /** Validade do access token em milissegundos (padrão 15 min). */
        long accessExpirationMs,
        /** Validade do refresh token em milissegundos (padrão 30 dias). */
        long refreshExpirationMs,
        /**
         * Chaves com kid, em JSON {@code {"kid": "segredo"}} (cada segredo >= 32 bytes), via
         * {@code JWT_CHAVES}. Texto e não mapa de propósito: um erro de conversão no bind
         * imprimiria o valor, com os segredos, no log de falha do boot.
         */
        String chaves,
        /** Kid que assina os tokens novos, via {@code JWT_CHAVE_ATIVA}. Vazio: assina a legada. */
        String chaveAtiva
) {
}
