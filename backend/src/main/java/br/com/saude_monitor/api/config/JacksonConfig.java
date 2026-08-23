package br.com.saude_monitor.api.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Fornece o bean {@link ObjectMapper} para a aplicação.
 *
 * <p>No Spring Boot 4.0 o {@code ObjectMapper} não é mais auto-configurado como bean por
 * padrão. Este bean garante a serialização JSON consistente — módulo {@code java.time}
 * para {@code Instant} e datas em formato ISO-8601 ({@code WRITE_DATES_AS_TIMESTAMPS}
 * desabilitado) — usada tanto pelos conversores HTTP quanto pela serialização manual nos
 * handlers de segurança (401/403).</p>
 */
@Configuration
public class JacksonConfig {

    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }
}
