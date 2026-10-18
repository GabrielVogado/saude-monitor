package br.com.saude_monitor.api.config.contencao;

import org.springframework.boot.mongodb.autoconfigure.MongoClientSettingsBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

/**
 * Aplica {@link MongoPoolProperties} ao cliente do MongoDB (SOL-07).
 *
 * <p>Roda depois do customizador padrão do Spring Boot (que lê a URI), então estes valores
 * valem mesmo que a {@code MONGO_URI} traga {@code maxPoolSize} ou tempos próprios.</p>
 */
@Configuration
public class MongoPoolConfig {

    @Bean
    MongoClientSettingsBuilderCustomizer mongoPoolCustomizer(MongoPoolProperties props) {
        return builder -> builder
                .applyToConnectionPoolSettings(pool -> pool
                        .maxSize(props.poolMaximo())
                        .minSize(props.poolMinimo())
                        .maxWaitTime(props.esperaConexao().toMillis(), TimeUnit.MILLISECONDS)
                        .maxConnectionIdleTime(props.ociosidadeMaxima().toMillis(), TimeUnit.MILLISECONDS))
                .applyToClusterSettings(cluster -> cluster
                        .serverSelectionTimeout(props.selecaoServidor().toMillis(), TimeUnit.MILLISECONDS))
                .applyToSocketSettings(socket -> socket
                        .readTimeout((int) props.leitura().toMillis(), TimeUnit.MILLISECONDS));
    }
}
