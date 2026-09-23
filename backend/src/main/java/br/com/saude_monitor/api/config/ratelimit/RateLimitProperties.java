package br.com.saude_monitor.api.config.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Propriedades do rate limiting (F0-04), lidas do prefixo {@code app.ratelimit}.
 *
 * <p>Os limites eram constantes do {@code enum} {@link RateLimitService.Grupo}. Viraram
 * configuração em 23/09/2026 para o ambiente de homologação poder receber carga de
 * teste de desempenho vinda de uma única máquina — com 60 req/min por IP, o teste
 * mediria o limitador, não o sistema. Os padrões em {@code application.properties}
 * são os valores de antes; só o deploy de homologação os sobrescreve.</p>
 *
 * <p>Registrada automaticamente pelo {@code @ConfigurationPropertiesScan}.</p>
 */
@ConfigurationProperties(prefix = "app.ratelimit")
public record RateLimitProperties(
        /** Login/refresh ({@code /api/v1/auth/**}), por IP e por minuto. */
        int authPorMinuto,
        /** Demais endpoints públicos, por IP e por minuto. */
        int publicoPorMinuto,
        /**
         * Quantos proxies confiáveis ficam entre o cliente e a aplicação, cada um
         * acrescentando um endereço ao FIM do {@code X-Forwarded-For}. O IP do cliente é
         * o que o proxy mais externo viu: o N-ésimo endereço contando da direita. No
         * Cloud Run o front-end do Google é esse único proxy ({@code 1}). {@code 0}
         * ignora o cabeçalho e usa o endereço da conexão.
         *
         * <p>Antes lia-se o PRIMEIRO endereço — que é o que o próprio cliente manda. Bastava
         * enviar um {@code X-Forwarded-For} diferente a cada requisição para nunca bater
         * no limite.</p>
         */
        int proxiesConfiaveis
) {
}
