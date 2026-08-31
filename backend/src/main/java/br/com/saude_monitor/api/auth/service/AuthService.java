package br.com.saude_monitor.api.auth.service;

import br.com.saude_monitor.api.auth.dto.AuthResponse;
import br.com.saude_monitor.api.auth.dto.LoginRequest;
import br.com.saude_monitor.api.auth.dto.RefreshRequest;
import jakarta.validation.Valid;

import java.util.Map;

/**
 * Contrato de autenticação (F0-01/F0-02) — login, renovação e encerramento de sessão JWT.
 */
public interface AuthService {

    /** Autentica credenciais e emite access + refresh tokens. */
    AuthResponse login(@Valid LoginRequest request);

    /** Renova o access token a partir de um refresh token válido (com rotação). */
    AuthResponse refresh(@Valid RefreshRequest request);

    /**
     * Encerra a sessão (logout) revogando o refresh token na blacklist.
     * Tokens já expirados/malformados são aceitos (idempotente) — nada a revogar.
     */
    Map<String, Object> logout(@Valid RefreshRequest request);
}
