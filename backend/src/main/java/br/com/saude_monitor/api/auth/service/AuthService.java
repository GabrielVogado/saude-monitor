package br.com.saude_monitor.api.auth.service;

import br.com.saude_monitor.api.auth.dto.AuthResponse;
import br.com.saude_monitor.api.auth.dto.ConfirmarEmailRequest;
import br.com.saude_monitor.api.auth.dto.EsqueciSenhaRequest;
import br.com.saude_monitor.api.auth.dto.LoginRequest;
import br.com.saude_monitor.api.auth.dto.RedefinirSenhaRequest;
import br.com.saude_monitor.api.auth.dto.ReenviarConfirmacaoRequest;
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

    /**
     * Envia um código de 6 dígitos por e-mail para redefinir a senha. Sempre devolve a
     * mesma resposta genérica, exista ou não o e-mail (não revela cadastro).
     */
    Map<String, Object> esqueciSenha(@Valid EsqueciSenhaRequest request);

    /**
     * Confirma o código e define a nova senha. Invalida refresh tokens emitidos antes
     * deste momento (ver {@link #refresh}).
     */
    Map<String, Object> redefinirSenha(@Valid RedefinirSenhaRequest request);

    /**
     * Envia o código de 6 dígitos para confirmar o e-mail do cadastro (10/09/2026).
     * Chamado pelo {@code UserServiceImpl} logo após criar a conta.
     */
    void enviarCodigoConfirmacaoEmail(String email);

    /** Confirma o e-mail com o código enviado no cadastro; libera o login. */
    Map<String, Object> confirmarEmail(@Valid ConfirmarEmailRequest request);

    /**
     * Reenvia o código de confirmação. Sempre devolve a mesma resposta genérica,
     * exista o e-mail ou não, e mesmo se já estiver confirmado.
     */
    Map<String, Object> reenviarConfirmacaoEmail(@Valid ReenviarConfirmacaoRequest request);
}
