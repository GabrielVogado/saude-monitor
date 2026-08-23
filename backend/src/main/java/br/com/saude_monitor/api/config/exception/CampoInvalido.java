package br.com.saude_monitor.api.config.exception;

/**
 * Detalhe de campo inválido, usado no campo {@code details} do envelope de erro.
 */
public record CampoInvalido(String campo, String mensagem) {
}
