package br.com.saude_monitor.api.auth.service.impl;

import br.com.saude_monitor.api.auth.dto.AuthResponse;
import br.com.saude_monitor.api.auth.dto.LoginRequest;
import br.com.saude_monitor.api.auth.dto.RefreshRequest;
import br.com.saude_monitor.api.auth.revogacao.RefreshTokenRevogadoDocument;
import br.com.saude_monitor.api.auth.revogacao.RefreshTokenRevogadoRepository;
import br.com.saude_monitor.api.config.exception.NaoAutorizadoException;
import br.com.saude_monitor.api.config.security.JwtProperties;
import br.com.saude_monitor.api.config.security.JwtService;
import br.com.saude_monitor.api.user.document.Papel;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Testes unitários do {@link AuthServiceImpl} (F0-01/F0-02) — login, refresh (com rotação
 * e blacklist) e logout (revogação do refresh token).
 */
class AuthServiceImplTest {

    private AuthServiceImpl authService;
    private UserRepository userRepository;
    private JwtService jwtService;
    private RefreshTokenRevogadoRepository revogadoRepository;

    @BeforeEach
    void setup() {
        userRepository = mock(UserRepository.class);
        revogadoRepository = mock(RefreshTokenRevogadoRepository.class);

        JwtProperties properties = new JwtProperties(
                "teste-secret-key-com-mais-de-32-bytes-para-hs256",
                900_000L,
                2_592_000_000L
        );
        jwtService = new JwtService(properties);

        authService = new AuthServiceImpl(userRepository, new BCryptPasswordEncoder(), jwtService, revogadoRepository);
    }

    private UserDocument usuarioAtivo(String email) {
        return UserDocument.builder()
                .id("1")
                .fullName("Marina Souza")
                .email(email)
                .senhaHash("hash")
                .papel(Papel.USER)
                .active(true)
                .build();
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
        UserDocument user = usuarioAtivo("marina@email.com");
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

    // ------------------------------------------------ Logout / blacklist (F0-02 §3.1) -------------------------------

    @Test
    void deveRevogarRefreshTokenNoLogout() {
        UserDocument user = usuarioAtivo("marina@email.com");
        String refreshToken = jwtService.generateRefreshToken(user);
        String jti = jwtService.extractJti(refreshToken);

        Map<String, Object> resposta = authService.logout(new RefreshRequest(refreshToken));

        assertTrue((Boolean) resposta.get("success"));
        // o refresh token apresentado entra na blacklist com TTL da própria expiração
        verify(revogadoRepository).insert(argThat((RefreshTokenRevogadoDocument doc) ->
                jti.equals(doc.getId())
                        && "marina@email.com".equals(doc.getEmail())
                        && doc.getExpiraEm() != null));
    }

    @Test
    void deveRejeitarRefreshDeTokenRevogado() {
        UserDocument user = usuarioAtivo("marina@email.com");
        String refreshToken = jwtService.generateRefreshToken(user);
        String jti = jwtService.extractJti(refreshToken);
        when(revogadoRepository.existsById(jti)).thenReturn(true);
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));

        NaoAutorizadoException ex = assertThrows(NaoAutorizadoException.class,
                () -> authService.refresh(new RefreshRequest(refreshToken)));

        assertEquals("Refresh token inválido ou expirado.", ex.getMessage());
        // token revogado não reemitido
        verify(revogadoRepository, never()).insert(any(RefreshTokenRevogadoDocument.class));
    }

    @Test
    void deveSerIdempotenteNoLogout() {
        // token malformado/expirado: nada a revogar, mas a resposta continua 200-like (success)
        Map<String, Object> resposta = authService.logout(new RefreshRequest("token-invalido"));

        assertTrue((Boolean) resposta.get("success"));
        verify(revogadoRepository, never()).insert(any(RefreshTokenRevogadoDocument.class));
    }
}
