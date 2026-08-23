package br.com.saude_monitor.api.user.document;

/**
 * Papel (role) do usuário no sistema, usado para autorização (Spring Security).
 *
 * <p>Espelha a seção 5 da Especificação da API v2.0:</p>
 * <ul>
 *   <li>{@link #USER} — usuário comum (padrão);</li>
 *   <li>{@link #ADMIN} — cadastro de hospitais (escrita em {@code /api/v1/hospitais}).</li>
 * </ul>
 */
public enum Papel {
    USER,
    ADMIN
}
