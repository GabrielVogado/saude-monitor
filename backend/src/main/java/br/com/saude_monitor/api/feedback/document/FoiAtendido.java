package br.com.saude_monitor.api.feedback.document;

/**
 * Resposta à pergunta "Conseguiu ser atendido por médico(a) desta especialidade?" (RN-10).
 *
 * <p>{@code SIM} → segue ao fluxo normal; {@code NAO} → exige {@code motivoNaoAtendido};
 * {@code DESISTI} → desistiu da espera.</p>
 */
public enum FoiAtendido {
    SIM,
    NAO,
    DESISTI
}
