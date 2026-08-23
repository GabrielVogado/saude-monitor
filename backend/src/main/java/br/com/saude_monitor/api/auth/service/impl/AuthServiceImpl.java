package br.com.saude_monitor.api.auth.service.impl;

import br.com.saude_monitor.api.auth.dto.AuthResponse;
import br.com.saude_monitor.api.auth.dto.LoginRequest;
import br.com.saude_monitor.api.auth.dto.RefreshRequest;
import br.com.saude_monitor.api.auth.dto.UsuarioDto;
import br.com.saude_monitor.api.auth.service.AuthService;
import br.com.saude_monitor.api.config.exception.NaoAutorizadoException;
import br.com.saude_monitor.api.config.security.JwtService;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Locale;

/**
 * Implementação de autenticação (F0-01).
 *
 * <p>Autentica credenciais contra o {@code senhaHash} (BCrypt) do usuário e emite
 * access (15 min) + refresh (30 dias) tokens JWT. O refresh rotaciona o par de tokens.
 * Mensagens de erro são genéricas para não revelar se o e-mail existe.</p>
 */
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private static final String CREDENCIAIS_INVALIDAS = "E-mail ou senha inválidos.";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

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
        if (!jwtService.isRefreshTokenValid(request.refreshToken())) {
            throw new NaoAutorizadoException("Refresh token inválido ou expirado.");
        }

        String email = jwtService.extractEmail(request.refreshToken());
        UserDocument user = userRepository.findByEmail(normalizeEmail(email))
                .filter(UserDocument::isActive)
                .orElseThrow(() -> new NaoAutorizadoException("Usuário não encontrado ou inativo."));

        // Rotação: emite um novo par (access + refresh), invalidando o refresh anterior no cliente.
        return emitirTokens(user);
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
