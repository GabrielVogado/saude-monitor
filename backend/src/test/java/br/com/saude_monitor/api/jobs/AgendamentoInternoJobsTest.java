package br.com.saude_monitor.api.jobs;

import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/** Disparo interno dos jobs, ligado por padrão (SOL-05). */
class AgendamentoInternoJobsTest {

    private final ExecutorJobs executor = mock(ExecutorJobs.class);
    private final AgendamentoInternoJobs agendamento = new AgendamentoInternoJobs(executor);

    @Test
    void cadaAgendamentoDisparaSeuJobPeloExecutor() {
        agendamento.indicadores();
        agendamento.expiracaoVisitas();
        agendamento.gpsInterrompido();
        agendamento.feedbackSemResposta();
        agendamento.retencaoDados();

        verify(executor).executar(NomeJob.INDICADORES);
        verify(executor).executar(NomeJob.EXPIRACAO_VISITAS);
        verify(executor).executar(NomeJob.GPS_INTERROMPIDO);
        verify(executor).executar(NomeJob.FEEDBACK_SEM_RESPOSTA);
        verify(executor).executar(NomeJob.RETENCAO_DADOS);
    }
}
