package br.com.saude_monitor.api.hospital.document;

/**
 * Status do ciclo de vida de uma sugestão pública de hospital (E1-05).
 *
 * <p>A sugestão nasce {@code PENDENTE} e aguarda revisão/aprovação por um
 * administrador, que pode {@link #APROVADA} (converte em cadastro) ou
 * {@link #RECUSADA}. A aprovação/recusa em si é fluxo administrativo posterior
 * ao Épico 01.</p>
 */
public enum StatusSugestao {
    PENDENTE,
    APROVADA,
    RECUSADA
}
