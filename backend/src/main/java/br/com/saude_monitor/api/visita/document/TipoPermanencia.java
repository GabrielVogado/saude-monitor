package br.com.saude_monitor.api.visita.document;

/**
 * Natureza da permanência de uma visita ativa (RN-24 / E2-10).
 *
 * <p>{@code ATENDIMENTO} é o padrão. O usuário pode sinalizar {@code OBSERVACAO} ou
 * {@code INTERNACAO} após 12h de visita ativa; a visita continua contabilizada no
 * histórico, mas sai do cálculo do tempo médio de pronto-atendimento (agregação, Épico 04).</p>
 */
public enum TipoPermanencia {
    ATENDIMENTO,
    OBSERVACAO,
    INTERNACAO
}
