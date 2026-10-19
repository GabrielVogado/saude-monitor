package br.com.saude_monitor.api.jobs;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

import java.util.Set;
import java.util.function.Predicate;

/**
 * Segurança dos endpoints internos de jobs (SOL-05), separada da cadeia da API.
 *
 * <p>Só passa o token OIDC que o Google emite para a conta de serviço do Cloud Scheduler:
 * assinatura conferida pelas chaves públicas do Google, emissor {@code accounts.google.com},
 * audiência igual à configurada e {@code email} igual à conta configurada, verificado. O
 * access token do app não serve aqui. Sem audiência e conta configuradas, a rota responde
 * 403 a qualquer chamada.</p>
 */
@Configuration
public class JobsSecurityConfig {

    /** Chaves públicas dos tokens de identidade do Google. */
    static final String JWKS_GOOGLE = "https://www.googleapis.com/oauth2/v3/certs";

    /** O Google emite os tokens com qualquer uma das duas formas do emissor. */
    static final Set<String> EMISSORES_GOOGLE = Set.of("https://accounts.google.com", "accounts.google.com");

    @Bean
    @Order(1)
    public SecurityFilterChain jobsSecurityFilterChain(HttpSecurity http, JobsProperties properties) {
        return construirCadeia(http, properties, criarDecoderGoogle(properties));
    }

    /** Cadeia com o decodificador recebido; os testes passam um com chave local. */
    static SecurityFilterChain construirCadeia(HttpSecurity http, JobsProperties properties, JwtDecoder decoder) {
        http
                .securityMatcher("/internal/**")
                // CSRF fica ligado: o resource server já dispensa a verificação quando a
                // requisição traz Bearer, que é a única credencial aceita aqui.
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
        if (properties.isEndpointsHabilitados()) {
            http.authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
                    .oauth2ResourceServer(rs -> rs.jwt(jwt -> jwt.decoder(decoder)));
        } else {
            http.authorizeHttpRequests(auth -> auth.anyRequest().denyAll());
        }
        return http.build();
    }

    static JwtDecoder criarDecoderGoogle(JobsProperties properties) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(JWKS_GOOGLE).build();
        decoder.setJwtValidator(criarValidador(properties));
        return decoder;
    }

    static OAuth2TokenValidator<Jwt> criarValidador(JobsProperties properties) {
        return new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(),
                // Texto, não getIssuer(): "accounts.google.com" não é URL e faria getIssuer() lançar.
                exigir(jwt -> EMISSORES_GOOGLE.contains(jwt.getClaimAsString("iss")),
                        "Emissor não é o Google."),
                exigir(jwt -> jwt.getAudience() != null && jwt.getAudience().contains(properties.audiencia()),
                        "Audiência diferente da configurada."),
                exigir(jwt -> properties.contaServico().equalsIgnoreCase(jwt.getClaimAsString("email"))
                                && Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified")),
                        "Conta de serviço não autorizada."));
    }

    private static OAuth2TokenValidator<Jwt> exigir(Predicate<Jwt> condicao, String motivo) {
        OAuth2Error erro = new OAuth2Error("invalid_token", motivo, null);
        return jwt -> condicao.test(jwt)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(erro);
    }
}
