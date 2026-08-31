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
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.List;

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

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/auth/**").permitAll()
                        // Check-in/checkout/heartbeat de visitas (Épico 02) admitem uso anônimo via
                        // dispositivoId (§3.3); a identificação obrigatória é validada em serviço.
                        .requestMatchers(HttpMethod.POST, "/api/v1/visitas/checkin",
                                "/api/v1/visitas/*/checkout", "/api/v1/visitas/*/heartbeat").permitAll()
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
                        .requestMatchers(HttpMethod.POST, "/api/v1/hospitais/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/hospitais/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/hospitais/**").hasRole("ADMIN")
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
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