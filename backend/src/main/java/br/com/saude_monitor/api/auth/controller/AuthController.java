package br.com.saude_monitor.api.auth.controller;

import br.com.saude_monitor.api.auth.dto.AuthResponse;
import br.com.saude_monitor.api.auth.dto.ConfirmarEmailRequest;
import br.com.saude_monitor.api.auth.dto.EsqueciSenhaRequest;
import br.com.saude_monitor.api.auth.dto.LoginRequest;
import br.com.saude_monitor.api.auth.dto.RedefinirSenhaRequest;
import br.com.saude_monitor.api.auth.dto.ReenviarConfirmacaoRequest;
import br.com.saude_monitor.api.auth.dto.RefreshRequest;
import br.com.saude_monitor.api.auth.service.AuthService;
import br.com.saude_monitor.api.user.dto.UserRequest;
import br.com.saude_monitor.api.user.dto.UserResponse;
import br.com.saude_monitor.api.user.service.UserService;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Endpoints de autenticação e conta (F0-01/F0-02), alinhados ao contrato v2.0 (§3.1).
 *
 * <p>Todos públicos ({@code permitAll} em {@code SecurityConfig}): registro, login,
 * refresh e logout (revoga o refresh token apresentado).</p>
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    private final AuthService authService;
    private final UserService userService;

    /** 🔓 Cria conta opcional (E5-04); exige aceite dos termos LGPD (consentimento.termosUso). */
    @PostMapping("/registro")
    @SecurityRequirements
    public ResponseEntity<UserResponse> registro(@Valid @RequestBody UserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.saveUser(request));
    }

    /** 🔓 Autentica credenciais e devolve access + refresh tokens. */
    @PostMapping("/login")
    @SecurityRequirements
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        // Nunca logar a senha — apenas a identidade, para rastreabilidade.
        logger.info("[AuthController] Login recebido para email={}", request.email());
        return ResponseEntity.ok(authService.login(request));
    }

    /** 🔓 Renova o access token a partir de um refresh token válido (rotação). */
    @PostMapping("/refresh")
    @SecurityRequirements
    public ResponseEntity<AuthResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ResponseEntity.ok(authService.refresh(request));
    }

    /**
     * 🔒 Encerra a sessão revogando o refresh token na blacklist (F0-02/§3.1).
     * Idempotente: devolve 200 mesmo se o token já estiver expirado/revogado.
     */
    @PostMapping("/logout")
    @SecurityRequirements
    public ResponseEntity<Map<String, Object>> logout(@Valid @RequestBody RefreshRequest request) {
        return ResponseEntity.ok(authService.logout(request));
    }

    /**
     * 🔓 Envia um código de 6 dígitos por e-mail para redefinir a senha ("esqueci minha
     * senha"). Resposta sempre genérica — não revela se o e-mail existe.
     */
    @PostMapping("/esqueci-senha")
    @SecurityRequirements
    public ResponseEntity<Map<String, Object>> esqueciSenha(@Valid @RequestBody EsqueciSenhaRequest request) {
        return ResponseEntity.ok(authService.esqueciSenha(request));
    }

    /** 🔓 Confirma o código enviado por e-mail e define a nova senha. */
    @PostMapping("/redefinir-senha")
    @SecurityRequirements
    public ResponseEntity<Map<String, Object>> redefinirSenha(@Valid @RequestBody RedefinirSenhaRequest request) {
        return ResponseEntity.ok(authService.redefinirSenha(request));
    }

    /**
     * 🔓 Confirma o e-mail do cadastro com o código de 6 dígitos enviado por
     * {@code POST /registro}. Sem confirmar, o login é recusado (403 EMAIL_NAO_CONFIRMADO).
     */
    @PostMapping("/confirmar-email")
    @SecurityRequirements
    public ResponseEntity<Map<String, Object>> confirmarEmail(@Valid @RequestBody ConfirmarEmailRequest request) {
        return ResponseEntity.ok(authService.confirmarEmail(request));
    }

    /**
     * 🔓 Reenvia o código de confirmação de e-mail. Resposta sempre genérica — não
     * revela se o e-mail existe nem se já está confirmado.
     */
    @PostMapping("/reenviar-confirmacao")
    @SecurityRequirements
    public ResponseEntity<Map<String, Object>> reenviarConfirmacao(@Valid @RequestBody ReenviarConfirmacaoRequest request) {
        return ResponseEntity.ok(authService.reenviarConfirmacaoEmail(request));
    }
}
