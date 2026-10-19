package br.com.saude_monitor.api.jobs;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Disparo dos jobs dentro da aplicação (SOL-05), como era antes.
 *
 * <p>No Cloud Run com cobrança por requisição, a CPU é estrangulada entre requisições e o
 * {@code @Scheduled} pode não disparar. Por isso, onde houver Cloud Scheduler, este disparo é
 * desligado ({@code app.jobs.agendamento-interno=false}) e os jobs passam a ser chamados por
 * {@code POST /internal/jobs/{nome}}. Ligado por padrão, para o desenvolvimento local e para
 * os ambientes atuais continuarem iguais.</p>
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.jobs", name = "agendamento-interno", havingValue = "true", matchIfMissing = true)
public class AgendamentoInternoJobs {

    private static final long QUINZE_MINUTOS_MS = 15 * 60 * 1000L;

    private final ExecutorJobs executor;

    @Scheduled(fixedRate = QUINZE_MINUTOS_MS)
    public void executarIndicadores() {
        executor.executar(NomeJob.INDICADORES);
    }

    @Scheduled(fixedRate = QUINZE_MINUTOS_MS)
    public void executarExpiracaoVisitas() {
        executor.executar(NomeJob.EXPIRACAO_VISITAS);
    }

    @Scheduled(fixedRate = QUINZE_MINUTOS_MS)
    public void executarGpsInterrompido() {
        executor.executar(NomeJob.GPS_INTERROMPIDO);
    }

    @Scheduled(fixedRate = QUINZE_MINUTOS_MS)
    public void executarFeedbackSemResposta() {
        executor.executar(NomeJob.FEEDBACK_SEM_RESPOSTA);
    }

    @Scheduled(cron = "0 30 3 * * *", zone = "America/Sao_Paulo")
    public void executarRetencaoDados() {
        executor.executar(NomeJob.RETENCAO_DADOS);
    }
}
