package br.com.saude_monitor.api.config.exception;

import org.springframework.http.HttpStatus;

/**
 * Login recusado por e-mail ainda não confirmado (403 — {@code EMAIL_NAO_CONFIRMADO}).
 *
 * <p>Diferente de {@link NaoAutorizadoException} (401): a credencial está correta, o
 * acesso é que está condicionado à confirmação do e-mail feita no cadastro
 * (10/09/2026) — por isso 403, não 401. Só é alcançável depois de validar senha
 * corretamente (mesmo ponto de {@code isActive()} em {@code AuthServiceImpl.login()}),
 * então não abre canal de enumeração de e-mail novo.</p>
 */
public class EmailNaoConfirmadoException extends ApiException {

    public EmailNaoConfirmadoException(String message) {
        super(HttpStatus.FORBIDDEN, "EMAIL_NAO_CONFIRMADO", message);
    }
}
