package br.com.saude_monitor.api.config.security;
import br.com.saude_monitor.api.config.ratelimit.RateLimitFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.HstsHeaderWriter;
import org.springframework.security.web.util.matcher.AnyRequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RestAuthenticationEntryPoint authenticationEntryPoint;
    private final RestAccessDeniedHandler accessDeniedHandler;
    private final RateLimitFilter rateLimitFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /** Um ano, mesmo teto usado pelo HSTS preload list do Chrome/Firefox. */
    private static final long HSTS_MAX_AGE_SEGUNDOS = TimeUnit.DAYS.toSeconds(365);

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                // HSTS (achado F-03 do pentest de 23/09/2026): o writer padrão do Spring
                // Security só emite o cabeçalho quando `request.isSecure()` é verdadeiro, e no
                // Cloud Run o TLS termina no front-end do Google — a aplicação recebe a
                // conexão como HTTP simples, então `isSecure()` é sempre falso e o cabeçalho
                // nunca saía. `AnyRequestMatcher` emite sempre, sem depender do esquema visto
                // pelo contêiner. Não usar `server.forward-headers-strategy=framework` para
                // isso: o `ForwardedHeaderFilter` do Spring confiaria cegamente no primeiro
                // endereço de `X-Forwarded-For`, reabrindo o contorno de rate limit do M-018
                // por um caminho diferente do `RateLimitFilter`.
                .headers(headers -> headers.addHeaderWriter(
                        new HstsHeaderWriter(AnyRequestMatcher.INSTANCE, HSTS_MAX_AGE_SEGUNDOS, true)))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/auth/**").permitAll()
                        // Check-in/checkout/heartbeat de visitas (Épico 02) admitem uso anônimo via
                        // dispositivoId (§3.3); a identificação obrigatória é validada em serviço.
                        // Consulta da visita ativa também é anônima via dispositivoId (modo sem login).
                        .requestMatchers(HttpMethod.POST, "/api/v1/visitas/checkin",
                                "/api/v1/visitas/*/checkout", "/api/v1/visitas/*/heartbeat").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/visitas/ativas").permitAll()
                        // Exceção PÚBLICA (spec §3.2 / E1-05): sugestão anônima de hospital.
                        // Deve vir ANTES da regra genérica de POST admin (a ordem importa).
                        .requestMatchers(HttpMethod.POST, "/api/v1/hospitais/sugestoes").permitAll()
                        // Feedback pós-saída (Épico 03 / F-05): criação é pública (anônimo, RN-20).
                        // GET/PUT exigem autenticação do dono (🔒) — cobertos por anyRequest().
                        .requestMatchers(HttpMethod.POST, "/api/v1/feedbacks").permitAll()
                        // Moderação de sugestões (E1-06): endpoints admin específicos.
                        .requestMatchers(HttpMethod.GET, "/api/v1/hospitais/sugestoes", "/api/v1/hospitais/sugestoes/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/v1/hospitais/sugestoes/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/v1/hospitais/**").permitAll()
                        // Camadas geográficas (F-11, §5): divisão administrativa/de saúde é
                        // dado público — mesmo regime dos GET de hospitais.
                        .requestMatchers(HttpMethod.GET, "/api/v1/camadas/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/hospitais/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/hospitais/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/hospitais/**").hasRole("ADMIN")
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        // Métricas de latência/erro por endpoint (E8-06): detalhe operacional
                        // interno, não um contrato público — exige papel ADMIN. Inclui o índice
                        // "/actuator" (HAL discovery): sem isso, cai em anyRequest().authenticated()
                        // e qualquer USER autenticado vê o link para os endpoints restritos.
                        .requestMatchers("/actuator", "/actuator/prometheus", "/actuator/metrics/**").hasRole("ADMIN")
                        // Contrato OpenAPI (E8-09): público, para quem consome a API sem estar autenticado.
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(rateLimitFilter, JwtAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
                "http://localhost:8081",
                "http://localhost:3000",
                "http://localhost:19006"
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(false);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}