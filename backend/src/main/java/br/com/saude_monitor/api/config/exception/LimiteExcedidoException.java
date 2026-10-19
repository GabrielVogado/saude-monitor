package br.com.saude_monitor.api.config.exception;

import org.springframework.http.HttpStatus;

/**
 * Limite de requisições excedido (429 — {@code LIMITE_EXCEDIDO}), quando a chave do limite
 * só existe no corpo da requisição: a conta no login e o refresh token na renovação
 * (ARQ-02). Mesmo código e mensagem do {@code RateLimitFilter}.
 */
public class LimiteExcedidoException extends ApiException {

    public LimiteExcedidoException(int limitePorMinuto) {
        super(HttpStatus.TOO_MANY_REQUESTS, "LIMITE_EXCEDIDO",
                "Muitas requisições. Tente novamente em instantes. Limite: " + limitePorMinuto + " por minuto.");
    }
}
