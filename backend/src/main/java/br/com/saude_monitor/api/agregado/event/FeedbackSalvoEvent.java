package br.com.saude_monitor.api.agregado.event;

/**
 * Evento de domínio disparado quando um feedback pós-saída é salvo (Épico 04).
 *
 * <p>Transporta apenas o {@code hospitalId} afetado. O recálculo do agregado é feito de
 * forma assíncrona/transacional ({@code AFTER_COMMIT}) para não bloquear o request de
 * criação do feedback nem depender do sucesso da transação (RN-18 — atualização ≤ 15min).</p>
 */
public record FeedbackSalvoEvent(String hospitalId) {
}
