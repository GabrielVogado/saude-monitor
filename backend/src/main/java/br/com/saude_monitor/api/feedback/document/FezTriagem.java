package br.com.saude_monitor.api.feedback.document;

/**
 * Resposta à pergunta "Você passou pela triagem ao chegar na unidade?" (RN-10).
 *
 * <p>{@code SIM} habilita a Tela 2 (especialidade + atendimento). {@code NAO} pula
 * direto à Tela 3 (tratamento); {@code NAO_SEI} também segue sem especialidade.</p>
 */
public enum FezTriagem {
    SIM,
    NAO,
    NAO_SEI
}
