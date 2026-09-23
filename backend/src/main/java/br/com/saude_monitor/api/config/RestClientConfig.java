package br.com.saude_monitor.api.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

/**
 * Fornece o bean {@link RestClient.Builder} para a aplicação.
 *
 * <p>Medido nesta entrega (feature "esqueci minha senha", 10/09/2026): diferente do
 * {@code spring-boot-starter-web} clássico, o {@code spring-boot-starter-webmvc} do Boot
 * 4.0 (módulo usado neste projeto) não registra {@code RestClient.Builder} como bean
 * automaticamente — {@code ResendEmailService} falhava a subir o contexto sem este bean
 * (mesma classe de achado do {@link JacksonConfig}, para o {@code ObjectMapper}).</p>
 */
@Configuration
public class RestClientConfig {

    @Bean
    public RestClient.Builder restClientBuilder() {
        return RestClient.builder();
    }
}
