package br.com.saude_monitor.api.auth.controller;

import br.com.saude_monitor.api.auth.dto.AuthResponse;
import br.com.saude_monitor.api.auth.dto.LoginRequest;
import br.com.saude_monitor.api.auth.dto.RefreshRequest;
import br.com.saude_monitor.api.auth.dto.UsuarioDto;
import br.com.saude_monitor.api.auth.service.AuthService;
import br.com.saude_monitor.api.config.exception.GlobalExceptionHandler;
import br.com.saude_monitor.api.user.dto.UserRequest;
import br.com.saude_monitor.api.user.dto.UserResponse;
import br.com.saude_monitor.api.user.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.time.Instant;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Testes do {@link AuthController} (standalone MockMvc), sem dependência de MongoDB/Security.
 */
class AuthControllerTest {

    private final AuthService authService = new AuthService() {
        @Override
        public AuthResponse login(LoginRequest request) {
            return new AuthResponse("access-token", "refresh-token", 900,
                    new UsuarioDto("1", "Marina Souza", request.email(), "USER"));
        }

        @Override
        public AuthResponse refresh(RefreshRequest request) {
            return new AuthResponse("new-access", "new-refresh", 900,
                    new UsuarioDto("1", "Marina Souza", "marina@email.com", "USER"));
        }

        @Override
        public Map<String, Object> logout(RefreshRequest request) {
            return Map.of("success", true, "message", "Sessão encerrada. Refresh token revogado.");
        }
    };

    private final UserService userService = new UserService() {
        @Override
        public UserResponse saveUser(UserRequest request) {
            return new UserResponse(true, "Usuário cadastrado com sucesso", "u1",
                    request.fullName(), request.email(), request.phone(),
                    true, Instant.now(), Instant.now());
        }

        @Override
        public Map<String, Object> exportarDados(String usuarioId) {
            return Map.of();
        }

        @Override
        public void excluirConta(String usuarioId) {
            // no-op no teste de controller
        }
    };

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders
                .standaloneSetup(new AuthController(authService, userService))
                .setValidator(validator)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void deveAutenticarERetornarTokens() throws Exception {
        String payload = """
                {
                  "email": "marina@email.com",
                  "password": "S3nh@Forte!",
                  "rememberDevice": false
                }
                """;

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("access-token"))
                .andExpect(jsonPath("$.refreshToken").value("refresh-token"))
                .andExpect(jsonPath("$.expiraEm").value(900))
                .andExpect(jsonPath("$.usuario.email").value("marina@email.com"));
    }

    @Test
    void deveRenovarTokens() throws Exception {
        String payload = "{\"refreshToken\":\"refresh-token\"}";

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("new-access"))
                .andExpect(jsonPath("$.refreshToken").value("new-refresh"));
    }

    @Test
    void deveRetornar400ComEnvelopePadraoQuandoEmailAusente() throws Exception {
        String payload = "{\"email\":\"\",\"password\":\"\"}";

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("CAMPOS_INVALIDOS"))
                .andExpect(jsonPath("$.traceId").exists());
    }

    @Test
    void deveRegistrarContaEmAuthRegistro() throws Exception {
        String payload = """
                {
                  "fullName": "Marina Souza",
                  "email": "marina@email.com",
                  "password": "S3nh@Forte!",
                  "phone": "(11) 99999-0000",
                  "consentimento": { "termosUso": true, "versaoTermos": "1.0" }
                }
                """;

        mockMvc.perform(post("/api/v1/auth/registro")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.email").value("marina@email.com"));
    }

    @Test
    void deveRetornar400QuandoConsentimentoAusenteNoRegistro() throws Exception {
        String payload = """
                {
                  "fullName": "Marina Souza",
                  "email": "marina@email.com",
                  "password": "S3nh@Forte!"
                }
                """;

        mockMvc.perform(post("/api/v1/auth/registro")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("CAMPOS_INVALIDOS"));
    }

    @Test
    void deveEncerrarSessaoNoLogout() throws Exception {
        String payload = "{\"refreshToken\":\"refresh-token\"}";

        mockMvc.perform(post("/api/v1/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Sessão encerrada. Refresh token revogado."));
    }
}
