package br.com.saude_monitor.api.config.exception;

import java.io.Serializable;

/**
 * Detalhe de campo inválido, usado no campo {@code details} do envelope de erro.
 *
 * <p>Serializável porque viaja dentro de {@link ApiException}.</p>
 */
public record CampoInvalido(String campo, String mensagem) implements Serializable {
}
