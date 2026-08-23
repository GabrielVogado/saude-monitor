package br.com.saude_monitor.api.auth.service;

import br.com.saude_monitor.api.auth.dto.AuthResponse;
import br.com.saude_monitor.api.auth.dto.LoginRequest;
import br.com.saude_monitor.api.auth.dto.RefreshRequest;
import jakarta.validation.Valid;

/**
 * Contrato de autenticação (F0-01) — login e renovação de tokens JWT.
 */
public interface AuthService {

    /** Autentica credenciais e emite access + refresh tokens. */
    AuthResponse login(@Valid LoginRequest request);

    /** Renova o access token a partir de um refresh token válido (com rotação). */
    AuthResponse refresh(@Valid RefreshRequest request);
}
