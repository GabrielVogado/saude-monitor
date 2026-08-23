package br.com.saude_monitor.api.auth.service.impl;

import br.com.saude_monitor.api.auth.dto.AuthResponse;
import br.com.saude_monitor.api.auth.dto.LoginRequest;
import br.com.saude_monitor.api.auth.dto.RefreshRequest;
import br.com.saude_monitor.api.config.exception.NaoAutorizadoException;
import br.com.saude_monitor.api.config.security.JwtProperties;
import br.com.saude_monitor.api.config.security.JwtService;
import br.com.saude_monitor.api.user.document.Papel;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Testes unitários do {@link AuthServiceImpl} (F0-01) — login e refresh.
 */
class AuthServiceImplTest {

    private AuthServiceImpl authService;
    private UserRepository userRepository;
    private JwtService jwtService;

    @BeforeEach
    void setup() {
        userRepository = mock(UserRepository.class);

        JwtProperties properties = new JwtProperties(
                "teste-secret-key-com-mais-de-32-bytes-para-hs256",
                900_000L,
                2_592_000_000L
        );
        jwtService = new JwtService(properties);

        authService = new AuthServiceImpl(userRepository, new BCryptPasswordEncoder(), jwtService);
    }

    @Test
    void deveAutenticarCredenciaisValidas() {
        String senhaHash = new BCryptPasswordEncoder().encode("S3nh@Forte!");
        UserDocument user = UserDocument.builder()
                .id("1")
                .fullName("Marina Souza")
                .email("marina@email.com")
                .senhaHash(senhaHash)
                .papel(Papel.USER)
                .active(true)
                .build();

        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));

        AuthResponse response = authService.login(new LoginRequest("marina@email.com", "S3nh@Forte!", false));

        assertNotNull(response.accessToken());
        assertNotNull(response.refreshToken());
        assertEquals(900, response.expiraEm());
        assertEquals("marina@email.com", response.usuario().email());
        assertEquals("USER", response.usuario().papel());
    }

    @Test
    void deveRejeitarSenhaIncorreta() {
        UserDocument user = UserDocument.builder()
                .id("1")
                .email("marina@email.com")
                .senhaHash(new BCryptPasswordEncoder().encode("outra-senha"))
                .papel(Papel.USER)
                .active(true)
                .build();

        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));

        assertThrows(NaoAutorizadoException.class,
                () -> authService.login(new LoginRequest("marina@email.com", "senha-errada", false)));
    }

    @Test
    void deveRejeitarUsuarioInexistente() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());

        assertThrows(NaoAutorizadoException.class,
                () -> authService.login(new LoginRequest("nao@existe.com", "qualquer", false)));
    }

    @Test
    void deveRenovarTokensComRefreshValido() {
        UserDocument user = UserDocument.builder()
                .id("1")
                .fullName("Marina Souza")
                .email("marina@email.com")
                .senhaHash("hash")
                .papel(Papel.USER)
                .active(true)
                .build();

        String refreshToken = jwtService.generateRefreshToken(user);
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));

        AuthResponse response = authService.refresh(new RefreshRequest(refreshToken));

        assertNotNull(response.accessToken());
        assertNotNull(response.refreshToken());
    }

    @Test
    void deveRejeitarRefreshInvalido() {
        assertThrows(NaoAutorizadoException.class,
                () -> authService.refresh(new RefreshRequest("token-invalido")));
    }
}
