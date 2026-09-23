package br.com.saude_monitor.api.config.exception;

import org.springframework.http.HttpStatus;

/**
 * Acesso negado a um recurso de outro usuário (403 — {@code ACESSO_NEGADO}).
 *
 * <p>Mesmo código que {@link br.com.saude_monitor.api.config.security.RestAccessDeniedHandler}
 * já usa quando o Spring Security barra por papel (BFLA). Esta classe cobre o caso
 * equivalente decidido em serviço — o chamador está autenticado (tem um JWT válido), só
 * não é dono do recurso pedido (BOLA): visita ou feedback de outro usuário.</p>
 *
 * <p>Antes dessas checagens usavam {@link NaoAutorizadoException} (401), que por definição
 * significa "não autenticado" — impreciso aqui, pois o chamador está autenticado (achado
 * F-02 do pentest de 23/09/2026, {@code Documentos/12-seguranca/Pentest-HML-2026-09-23.md}).
 * O acesso já era negado; só o código HTTP mudou.</p>
 */
public class AcessoNegadoException extends ApiException {

    public AcessoNegadoException(String message) {
        super(HttpStatus.FORBIDDEN, "ACESSO_NEGADO", message);
    }
}
