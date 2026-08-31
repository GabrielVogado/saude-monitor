package br.com.saude_monitor.api.auth.controller;

import br.com.saude_monitor.api.auth.dto.AuthResponse;
import br.com.saude_monitor.api.auth.dto.LoginRequest;
import br.com.saude_monitor.api.auth.dto.RefreshRequest;
import br.com.saude_monitor.api.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Endpoints de autenticação (F0-01/F0-02), alinhados ao contrato v2.0 (§3.1).
 *
 * <p>Todos públicos ({@code permitAll} em {@code SecurityConfig}): login, refresh e
 * logout (revoga o refresh token apresentado).</p>
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    private final AuthService authService;

    /** 🔓 Autentica credenciais e devolve access + refresh tokens. */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        // Nunca logar a senha — apenas a identidade, para rastreabilidade.
        logger.info("[AuthController] Login recebido para email={}", request.email());
        return ResponseEntity.ok(authService.login(request));
    }

    /** 🔓 Renova o access token a partir de um refresh token válido (rotação). */
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ResponseEntity.ok(authService.refresh(request));
    }

    /**
     * 🔒 Encerra a sessão revogando o refresh token na blacklist (F0-02/§3.1).
     * Idempotente: devolve 200 mesmo se o token já estiver expirado/revogado.
     */
    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(@Valid @RequestBody RefreshRequest request) {
        return ResponseEntity.ok(authService.logout(request));
    }
}
