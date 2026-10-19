package br.com.saude_monitor.api.jobs;

/** Nomes dos jobs no caminho {@code POST /internal/jobs/{nome}} e no log (SOL-05). */
public final class NomeJob {

    public static final String INDICADORES = "indicadores";
    public static final String EXPIRACAO_VISITAS = "expiracao-visitas";
    public static final String GPS_INTERROMPIDO = "gps-interrompido";
    public static final String FEEDBACK_SEM_RESPOSTA = "feedback-sem-resposta";
    public static final String RETENCAO_DADOS = "retencao-dados";

    private NomeJob() {
    }
}
