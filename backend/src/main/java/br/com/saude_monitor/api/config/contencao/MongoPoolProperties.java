package br.com.saude_monitor.api.config.contencao;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

/**
 * Pool e tempos de espera do driver do MongoDB (SOL-07), lidos do prefixo {@code app.mongo}.
 *
 * <p>Os padrões do driver são pensados para servidor dedicado: 100 conexões por instância,
 * 2 minutos esperando conexão livre, 30 segundos escolhendo servidor e leitura sem prazo.
 * No Atlas compartilhado (teto de 500 conexões no cluster) e com virtual threads, isso
 * deixava poucas instâncias esgotarem o cluster e uma requisição presa por minutos.</p>
 *
 * <p>Registrada automaticamente pelo {@code @ConfigurationPropertiesScan}.</p>
 */
@Validated
@ConfigurationProperties(prefix = "app.mongo")
public record MongoPoolProperties(
        /** Conexões por instância, no máximo. Instâncias x este valor fica abaixo do teto do cluster. */
        @Positive int poolMaximo,
        /** Conexões mantidas abertas mesmo sem uso. */
        @PositiveOrZero int poolMinimo,
        /** Espera por uma conexão livre do pool; depois disso a requisição vira 503. */
        @NotNull Duration esperaConexao,
        /** Espera para achar um servidor disponível (eleição, rede); depois disso, 503. */
        @NotNull Duration selecaoServidor,
        /** Prazo de leitura do socket: uma consulta que passa disso é abandonada. */
        @NotNull Duration leitura,
        /** Conexão ociosa por mais que isso é fechada e devolvida ao cluster. */
        @NotNull Duration ociosidadeMaxima
) {
}
