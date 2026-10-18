package br.com.saude_monitor.api.jobs;

import br.com.saude_monitor.api.config.trava.TravaDistribuida;
import br.com.saude_monitor.api.configuracao.service.ConfiguracaoRemotaService;
import br.com.saude_monitor.api.feedback.service.FeedbackSemRespostaJob;
import br.com.saude_monitor.api.indicador.service.IndicadorHospitalJob;
import br.com.saude_monitor.api.visita.service.RetencaoDadosPessoaisJob;
import br.com.saude_monitor.api.visita.service.VisitaExpiracaoJob;
import br.com.saude_monitor.api.visita.service.VisitaGpsInterrompidoJob;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Execução dos jobs por nome, sob trava (SOL-05). */
class ExecutorJobsTest {

    private final TravaDistribuida trava = mock(TravaDistribuida.class);
    private final ConfiguracaoRemotaService configuracao = mock(ConfiguracaoRemotaService.class);
    private final IndicadorHospitalJob indicadores = mock(IndicadorHospitalJob.class);
    private final VisitaExpiracaoJob expiracao = mock(VisitaExpiracaoJob.class);
    private final VisitaGpsInterrompidoJob gps = mock(VisitaGpsInterrompidoJob.class);
    private final FeedbackSemRespostaJob semResposta = mock(FeedbackSemRespostaJob.class);
    private final RetencaoDadosPessoaisJob retencao = mock(RetencaoDadosPessoaisJob.class);

    private final ExecutorJobs executor =
            new ExecutorJobs(trava, configuracao, indicadores, expiracao, gps, semResposta, retencao);

    private void travaLivre() {
        when(trava.executar(anyString(), any(Duration.class), any(Runnable.class))).thenAnswer(inv -> {
            inv.<Runnable>getArgument(2).run();
            return true;
        });
    }

    @Test
    void conheceOsCincoJobs() {
        assertThat(executor.nomes()).containsExactly("indicadores", "expiracao-visitas", "gps-interrompido",
                "feedback-sem-resposta", "retencao-dados");
    }

    @Test
    void executaCadaJobPeloNomeSobATravaDoProprioJob() {
        travaLivre();

        assertThat(executor.executar("indicadores")).contains(ExecutorJobs.Resultado.EXECUTADO);
        executor.executar("expiracao-visitas");
        executor.executar("gps-interrompido");
        executor.executar("feedback-sem-resposta");
        executor.executar("retencao-dados");

        verify(trava).executar(eq("job-indicadores"), eq(ExecutorJobs.VALIDADE_TRAVA), any(Runnable.class));
        verify(indicadores).executar();
        verify(expiracao).executar();
        verify(gps).executar();
        verify(semResposta).executar();
        verify(retencao).executar();
    }

    @Test
    void pulaQuandoOutraInstanciaEstaComAJob() {
        when(trava.executar(anyString(), any(Duration.class), any(Runnable.class))).thenReturn(false);

        assertThat(executor.executar("indicadores")).contains(ExecutorJobs.Resultado.PULADO);
        verify(indicadores, never()).executar();
    }

    @Test
    void pulaNoModoSomenteLeituraSemPegarATrava() {
        when(configuracao.modoSomenteLeitura()).thenReturn(true);

        assertThat(executor.executar("retencao-dados")).contains(ExecutorJobs.Resultado.PULADO);
        verifyNoInteractions(trava, retencao);
    }

    @Test
    void nomeDesconhecidoNaoExecutaNada() {
        assertThat(executor.executar("apagar-tudo")).isEmpty();
        verifyNoInteractions(trava);
    }

    @Test
    void falhaDoJobSobeParaQuemDisparou() {
        travaLivre();
        doThrow(new IllegalStateException("Mongo fora")).when(gps).executar();

        assertThatThrownBy(() -> executor.executar("gps-interrompido"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Mongo fora");
    }
}
