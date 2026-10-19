package br.com.saude_monitor.api.config.contencao;

import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Contenção de falhas (ARQ-05), lida do prefixo {@code app.contencao}.
 *
 * <p>Registrada automaticamente pelo {@code @ConfigurationPropertiesScan}.</p>
 */
@Validated
@ConfigurationProperties(prefix = "app.contencao")
public record ContencaoProperties(
        /**
         * Requisições atendidas ao mesmo tempo por instância. Com virtual threads o Tomcat não
         * tem mais o teto natural do pool de threads: sem este limite, um pico empilha
         * milhares de requisições esperando conexão do banco, e todas estouram o tempo juntas.
         * Acima dele, a instância responde 503 na hora, com {@code Retry-After}.
         */
        @Positive int requisicoesSimultaneas,
        /** {@code Retry-After} do 503 por sobrecarga da instância, em segundos. */
        @Positive int retryAfterSegundos,
        /** {@code Retry-After} do 503 do modo somente leitura, em segundos. */
        @Positive int retryAfterSomenteLeituraSegundos,
        /**
         * Liga o modo somente leitura por variável de ambiente, sem depender do banco: serve
         * para quando o próprio banco está fora ou em manutenção e a flag guardada nele não
         * pode ser gravada nem lida (ARQ-09).
         */
        boolean somenteLeituraForcado
) {
}
