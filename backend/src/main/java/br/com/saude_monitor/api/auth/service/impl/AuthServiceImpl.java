package br.com.saude_monitor.api.auth.service.impl;

import br.com.saude_monitor.api.auth.dto.AuthResponse;
import br.com.saude_monitor.api.auth.dto.LoginRequest;
import br.com.saude_monitor.api.auth.dto.RefreshRequest;
import br.com.saude_monitor.api.auth.dto.UsuarioDto;
import br.com.saude_monitor.api.auth.revogacao.RefreshTokenRevogadoDocument;
import br.com.saude_monitor.api.auth.revogacao.RefreshTokenRevogadoRepository;
import br.com.saude_monitor.api.auth.service.AuthService;
import br.com.saude_monitor.api.config.exception.NaoAutorizadoException;
import br.com.saude_monitor.api.config.security.JwtService;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Locale;
import java.util.Map;

/**
 * Implementação de autenticação (F0-01/F0-02).
 *
 * <p>Autentica credenciais contra o {@code senhaHash} (BCrypt) do usuário e emite
 * access (15 min) + refresh (30 dias) tokens JWT. O refresh rotaciona o par e o logout
 * revoga o refresh token em uma {@link RefreshTokenRevogadoDocument blacklist} (TTL).
 * Mensagens de erro são genéricas para não revelar se o e-mail existe.</p>
 */
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private static final Logger logger = LoggerFactory.getLogger(AuthServiceImpl.class);
    private static final String CREDENCIAIS_INVALIDAS = "E-mail ou senha inválidos.";
    private static final String REFRESH_INVALIDO = "Refresh token inválido ou expirado.";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenRevogadoRepository refreshTokenRevogadoRepository;

    @Override
    public AuthResponse login(LoginRequest request) {
        UserDocument user = userRepository.findByEmail(normalizeEmail(request.email()))
                .filter(u -> u.getSenhaHash() != null)
                .filter(u -> passwordEncoder.matches(request.password(), u.getSenhaHash()))
                .orElseThrow(() -> new NaoAutorizadoException(CREDENCIAIS_INVALIDAS));

        if (!user.isActive()) {
            throw new NaoAutorizadoException("Conta desativada.");
        }

        return emitirTokens(user);
    }

    @Override
    public AuthResponse refresh(RefreshRequest request) {
        String token = request.refreshToken();
        if (!jwtService.isRefreshTokenValid(token)) {
            throw new NaoAutorizadoException(REFRESH_INVALIDO);
        }

        // Blacklist (F0-02/§3.1): refresh revogado no logout não gera novo access token.
        if (refreshTokenRevogadoRepository.existsById(jwtService.extractJti(token))) {
            logger.warn("Tentativa de refresh com token revogado; bloqueado.");
            throw new NaoAutorizadoException(REFRESH_INVALIDO);
        }

        String email = jwtService.extractEmail(token);
        UserDocument user = userRepository.findByEmail(normalizeEmail(email))
                .filter(UserDocument::isActive)
                .orElseThrow(() -> new NaoAutorizadoException("Usuário não encontrado ou inativo."));

        // Rotação: revoga o refresh anterior (especificação §3.1) e emite novo par.
        revogar(token);
        return emitirTokens(user);
    }

    @Override
    public Map<String, Object> logout(RefreshRequest request) {
        String token = request.refreshToken();

        if (jwtService.isRefreshTokenValid(token)) {
            revogar(token);
            logger.info("Sessão encerrada (logout): refresh token revogado.");
        }
        // Idempotente: token já expirado/malformado não tem o que revogar; resposta é a mesma.

        return Map.of(
                "success", true,
                "message", "Sessão encerrada. Refresh token revogado."
        );
    }

    /** Insere o token na blacklist com TTL replicando a própria expiração do refresh. */
    private void revogar(String token) {
        try {
            refreshTokenRevogadoRepository.insert(RefreshTokenRevogadoDocument.builder()
                    .id(jwtService.extractJti(token))
                    .email(jwtService.extractEmail(token))
                    .revogadoEm(Instant.now())
                    .expiraEm(jwtService.extractExpiration(token))
                    .build());
        } catch (RuntimeException ex) {
            // Registro duplicado (idêntico ao jti, ex.: logout repetido) é esperado e inofensivo.
            logger.debug("Revogação já registrada para o jti: {}", ex.getMessage());
        }
    }

    private AuthResponse emitirTokens(UserDocument user) {
        return new AuthResponse(
                jwtService.generateAccessToken(user),
                jwtService.generateRefreshToken(user),
                jwtService.accessExpirationSeconds(),
                toUsuarioDto(user)
        );
    }

    private UsuarioDto toUsuarioDto(UserDocument user) {
        return new UsuarioDto(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPapel() == null ? "USER" : user.getPapel().name()
        );
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
