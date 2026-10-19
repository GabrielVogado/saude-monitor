package br.com.saude_monitor.api.config.contencao;

import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** Pool e tempos do driver do MongoDB (SOL-07). */
class MongoPoolConfigTest {

    @Test
    void aplicaPoolETemposPorCimaDaUri() {
        MongoPoolProperties props = new MongoPoolProperties(20, 0, Duration.ofSeconds(2),
                Duration.ofSeconds(5), Duration.ofSeconds(30), Duration.ofSeconds(60));
        MongoClientSettings.Builder builder = MongoClientSettings.builder()
                .applyConnectionString(new ConnectionString("mongodb://localhost/db?maxPoolSize=500"));

        new MongoPoolConfig().mongoPoolCustomizer(props).customize(builder);
        MongoClientSettings settings = builder.build();

        assertThat(settings.getConnectionPoolSettings().getMaxSize()).isEqualTo(20);
        assertThat(settings.getConnectionPoolSettings().getMinSize()).isZero();
        assertThat(settings.getConnectionPoolSettings().getMaxWaitTime(TimeUnit.MILLISECONDS)).isEqualTo(2000);
        assertThat(settings.getConnectionPoolSettings().getMaxConnectionIdleTime(TimeUnit.SECONDS)).isEqualTo(60);
        assertThat(settings.getClusterSettings().getServerSelectionTimeout(TimeUnit.MILLISECONDS)).isEqualTo(5000);
        assertThat(settings.getSocketSettings().getReadTimeout(TimeUnit.MILLISECONDS)).isEqualTo(30000);
    }
}
