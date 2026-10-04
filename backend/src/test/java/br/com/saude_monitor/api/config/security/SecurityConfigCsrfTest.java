package br.com.saude_monitor.api.config.security;

import br.com.saude_monitor.api.config.ratelimit.RateLimitFilter;
import br.com.saude_monitor.api.config.ratelimit.RateLimitProperties;
import br.com.saude_monitor.api.config.ratelimit.RateLimitService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.Filter;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.User;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Sustenta o {@code csrf.disable()} do {@link SecurityConfig} (Sonar java:S4502).
 *
 * <p>CSRF só existe quando o navegador anexa sozinho uma credencial (cookie de sessão,
 * Basic) a uma requisição forjada por outro site. Aqui a única credencial aceita é o
 * Bearer no cabeçalho {@code Authorization}, que um formulário de terceiro não consegue
 * enviar. Estes testes travam essa premissa com a cadeia de segurança real: se alguém
 * passar a autenticar por cookie ou criar sessão, eles quebram e o CSRF precisa voltar.</p>
 *
 * <p>Sobe só o MVC + a {@link SecurityConfig} com um controller de teste, sem MongoDB.</p>
 */
@SpringJUnitWebConfig(SecurityConfigCsrfTest.Contexto.class)
class SecurityConfigCsrfTest {

    private static final String ROTA = "/api/v1/teste-csrf";
    private static final String ORIGEM_ATACANTE = "https://site-malicioso.example";
    private static final String ORIGEM_PAINEL = "http://localhost:4200";
    private static final String TOKEN_VALIDO = "token-valido";
    private static final String EMAIL = "admin@saude-monitor.app";

    @Autowired
    private WebApplicationContext contexto;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private CustomUserDetailsService userDetailsService;

    @Autowired
    private SecurityConfig securityConfig;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        reset(jwtService, userDetailsService);
        when(jwtService.extractEmail(TOKEN_VALIDO)).thenReturn(EMAIL);
        when(jwtService.isAccessTokenValid(TOKEN_VALIDO, EMAIL)).thenReturn(true);
        when(jwtService.extractEmail(eq("lixo"))).thenThrow(new IllegalArgumentException("token inválido"));
        when(userDetailsService.loadUserByUsername(anyString())).thenReturn(
                User.withUsername(EMAIL).password("x").roles("ADMIN").build());
        mockMvc = MockMvcBuilders.webAppContextSetup(contexto)
                .addFilters(contexto.getBean("springSecurityFilterChain", Filter.class))
                .build();
    }

    /** O que um formulário HTML consegue mandar: cookies do navegador, nada de Authorization. */
    private static MockHttpServletRequestBuilder soComCookies(MockHttpServletRequestBuilder req) {
        return req.contentType("application/x-www-form-urlencoded")
                .content("nome=forjado")
                .cookie(new Cookie("JSESSIONID", "sessao-da-vitima"),
                        new Cookie("refreshToken", TOKEN_VALIDO),
                        new Cookie("accessToken", TOKEN_VALIDO));
    }

    @Test
    void postDeOutroSiteSoComCookiesEhBarradoJaNoCors() throws Exception {
        // Primeira barreira: origem fora da lista → o CorsFilter recusa antes do controller.
        mockMvc.perform(soComCookies(post(ROTA)).header("Origin", ORIGEM_ATACANTE))
                .andExpect(status().isForbidden());
    }

    @Test
    void cookiesSozinhosNaoAutenticamNemSemABarreiraDoCors() throws Exception {
        // Mesmo que a origem passasse (ou o Origin viesse ausente), cookie não é credencial:
        // POST, PUT e DELETE caem no 401 — não há sessão do navegador a ser sequestrada.
        mockMvc.perform(soComCookies(post(ROTA))).andExpect(status().isUnauthorized());
        mockMvc.perform(soComCookies(put(ROTA)).header("Origin", ORIGEM_PAINEL))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(soComCookies(delete(ROTA)).header("Origin", ORIGEM_PAINEL))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenNoParametroDoFormularioNaoAutentica() throws Exception {
        // Outra forma de um formulário "carregar" a credencial: no corpo/query.
        mockMvc.perform(post(ROTA)
                        .param("access_token", TOKEN_VALIDO)
                        .param("Authorization", "Bearer " + TOKEN_VALIDO))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void bearerInvalidoEhRecusado() throws Exception {
        mockMvc.perform(post(ROTA).header("Authorization", "Bearer lixo"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void chamadaLegitimaComBearerPassaSemTokenCsrf() throws Exception {
        // Painel e app: Bearer no cabeçalho, sem X-XSRF-TOKEN — precisa continuar passando.
        mockMvc.perform(post(ROTA).header("Origin", ORIGEM_PAINEL)
                        .header("Authorization", "Bearer " + TOKEN_VALIDO))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("Set-Cookie"));
        mockMvc.perform(delete(ROTA).header("Authorization", "Bearer " + TOKEN_VALIDO))
                .andExpect(status().isOk());
    }

    @Test
    void autenticacaoNaoCriaSessaoNemCookieReaproveitavel() throws Exception {
        var resultado = mockMvc.perform(post(ROTA).header("Authorization", "Bearer " + TOKEN_VALIDO))
                .andExpect(status().isOk())
                .andReturn();
        // STATELESS: nada que o navegador possa reenviar sozinho depois.
        assertThat(resultado.getRequest().getSession(false)).isNull();
        assertThat(resultado.getResponse().getCookies()).isEmpty();
    }

    @Test
    void corsNaoLiberaCredenciaisDoNavegador() {
        var requisicao = new org.springframework.mock.web.MockHttpServletRequest("POST", ROTA);
        CorsConfiguration cors = securityConfig.corsConfigurationSource().getCorsConfiguration(requisicao);
        assertThat(cors).isNotNull();
        assertThat(cors.getAllowCredentials()).isFalse();
        assertThat(cors.getAllowedOrigins()).containsExactly(ORIGEM_PAINEL).doesNotContain("*");
    }

    @RestController
    static class ControllerDeTeste {
        @PostMapping(ROTA)
        String criar() {
            return "ok";
        }

        @PutMapping(ROTA)
        String alterar() {
            return "ok";
        }

        @DeleteMapping(ROTA)
        String remover() {
            return "ok";
        }
    }

    @Configuration
    @EnableWebMvc
    @Import({SecurityConfig.class, ControllerDeTeste.class})
    static class Contexto {
        private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

        @Bean
        JwtService jwtService() {
            return mock(JwtService.class);
        }

        @Bean
        CustomUserDetailsService customUserDetailsService() {
            return mock(CustomUserDetailsService.class);
        }

        @Bean
        JwtAuthenticationFilter jwtAuthenticationFilter(JwtService jwt, CustomUserDetailsService uds) {
            return new JwtAuthenticationFilter(jwt, uds);
        }

        @Bean
        RestAuthenticationEntryPoint restAuthenticationEntryPoint() {
            return new RestAuthenticationEntryPoint(objectMapper);
        }

        @Bean
        RestAccessDeniedHandler restAccessDeniedHandler() {
            return new RestAccessDeniedHandler(objectMapper);
        }

        @Bean
        RateLimitFilter rateLimitFilter() {
            // A rota de teste não pertence a nenhum grupo limitado: o filtro só repassa.
            return new RateLimitFilter(mock(RateLimitService.class), objectMapper, mock(RateLimitProperties.class));
        }

        @Bean
        CorsProperties corsProperties() {
            return new CorsProperties(List.of(ORIGEM_PAINEL));
        }
    }
}
