package br.com.saude_monitor.api.auth.controller;

import br.com.saude_monitor.api.auth.dto.AuthResponse;
import br.com.saude_monitor.api.auth.dto.LoginRequest;
import br.com.saude_monitor.api.auth.dto.PainelAuthResponse;
import br.com.saude_monitor.api.auth.dto.RefreshRequest;
import br.com.saude_monitor.api.auth.service.AuthService;
import br.com.saude_monitor.api.config.exception.LimiteExcedidoException;
import br.com.saude_monitor.api.config.exception.NaoAutorizadoException;
import br.com.saude_monitor.api.config.ratelimit.RateLimitService;
import br.com.saude_monitor.api.config.security.JwtService;
import br.com.saude_monitor.api.user.util.EmailNormalizer;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.Map;

/**
 * Sessão do Painel Admin com o refresh em cookie {@code HttpOnly} (ADR-013, SEG-05).
 *
 * <p>Rotas só do painel; o contrato do app ({@code /login}, {@code /refresh},
 * {@code /logout} com o refresh no corpo) não muda. O access token sai no corpo e o refresh
 * só no cookie {@value #COOKIE_REFRESH}: prefixo {@code __Host-} (o navegador só aceita com
 * {@code Secure}, {@code Path=/} e sem {@code Domain}), {@code HttpOnly} (fora do alcance do
 * JavaScript e de um XSS) e {@code SameSite=Strict} (não vai em requisição de outro site).
 * O {@code PainelCsrfFilter} exige a origem do painel e {@code X-Requested-With: painel}
 * antes de qualquer uma destas rotas.</p>
 */
@RestController
@RequestMapping("/api/v1/auth/painel")
@RequiredArgsConstructor
public class PainelAuthController {

    static final String COOKIE_REFRESH = "__Host-painel_refresh";

    private static final Logger logger = LoggerFactory.getLogger(PainelAuthController.class);

    private final AuthService authService;
    private final RateLimitService rateLimitService;
    private final JwtService jwtService;

    /** 🔓 Login do painel: só ADMIN. Access no corpo, refresh no cookie. */
    @PostMapping("/login")
    @SecurityRequirements
    public ResponseEntity<PainelAuthResponse> login(@Valid @RequestBody LoginRequest request) {
        logger.info("[PainelAuth] Login do painel recebido para email={}", request.email());
        // Mesmo limite por conta do login do app (ARQ-02), além do limite por IP do filtro.
        if (!rateLimitService.tentarConsumir("login:" + EmailNormalizer.normalizar(request.email()),
                RateLimitService.Grupo.LOGIN)) {
            throw new LimiteExcedidoException(rateLimitService.limite(RateLimitService.Grupo.LOGIN));
        }
        return comCookieDeRefresh(authService.loginPainel(request));
    }

    /** 🔓 Renova a sessão do painel com o refresh do cookie; o cookie sai rotacionado. */
    @PostMapping("/refresh")
    @SecurityRequirements
    public ResponseEntity<PainelAuthResponse> refresh(
            @CookieValue(name = COOKIE_REFRESH, required = false) String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new NaoAutorizadoException("Sessão do painel ausente.");
        }
        return comCookieDeRefresh(authService.refreshPainel(refreshToken));
    }

    /**
     * 🔓 Encerra a sessão do painel: revoga o refresh do cookie na blacklist e apaga o cookie.
     * Idempotente: sem cookie, ou com refresh já vencido ou revogado, responde igual.
     */
    @PostMapping("/logout")
    @SecurityRequirements
    public ResponseEntity<Map<String, Object>> logout(
            @CookieValue(name = COOKIE_REFRESH, required = false) String refreshToken) {
        Map<String, Object> corpo = refreshToken == null || refreshToken.isBlank()
                ? Map.of("success", true, "message", "Sessão encerrada.")
                : authService.logout(new RefreshRequest(refreshToken));
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookieDeRefresh("", Duration.ZERO).toString())
                .body(corpo);
    }

    private ResponseEntity<PainelAuthResponse> comCookieDeRefresh(AuthResponse resposta) {
        ResponseCookie cookie = cookieDeRefresh(resposta.refreshToken(),
                Duration.ofSeconds(jwtService.refreshExpirationSeconds()));
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(PainelAuthResponse.de(resposta));
    }

    private static ResponseCookie cookieDeRefresh(String valor, Duration validade) {
        return ResponseCookie.from(COOKIE_REFRESH, valor)
                .secure(true)
                .httpOnly(true)
                .sameSite("Strict")
                .path("/")
                .maxAge(validade)
                .build();
    }
}
