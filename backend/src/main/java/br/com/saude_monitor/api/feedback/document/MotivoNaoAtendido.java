package br.com.saude_monitor.api.feedback.document;

/**
 * Motivo do não atendimento (RN-10). Informado quando {@code foiAtendido = NAO}.
 *
 * <p>Regras transversais (Feat. F-05): {@code CLASSIFICACAO_RISCO} (priorização a casos
 * mais graves / Protocolo Manchester) <b>não é gap</b> — card "Fluxo Correto" no painel
 * admin; {@code FALTA_MEDICO} → gap RH; {@code LOTACAO} → gap Capacidade/Fluxo.
 * O frontend envia o label amigável {@code CASOS_MAIS_GRAVES_PRIORIDADE} e o backend
 * normaliza para {@code CLASSIFICACAO_RISCO}.</p>
 */
public enum MotivoNaoAtendido {
    FALTA_MEDICO,
    LOTACAO,
    CLASSIFICACAO_RISCO,
    OUTRO
}
