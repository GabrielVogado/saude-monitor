package br.com.saude_monitor.api.jobs;

import br.com.saude_monitor.api.config.trava.TravaDistribuida;
import br.com.saude_monitor.api.feedback.service.FeedbackSemRespostaJob;
import br.com.saude_monitor.api.indicador.service.IndicadorHospitalJob;
import br.com.saude_monitor.api.visita.service.RetencaoDadosPessoaisJob;
import br.com.saude_monitor.api.visita.service.VisitaExpiracaoJob;
import br.com.saude_monitor.api.visita.service.VisitaGpsInterrompidoJob;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Executa os jobs periódicos por nome, uma instância por vez (SOL-05).
 *
 * <p>Os dois disparos (o {@code @Scheduled} interno e o Cloud Scheduler chamando
 * {@code POST /internal/jobs/{nome}}) passam por aqui. Cada execução roda sob a
 * {@link TravaDistribuida}: com N instâncias, ou com os dois disparos ligados ao mesmo tempo,
 * o job roda uma vez e as outras chamadas são puladas. Todos os jobs são idempotentes (só
 * mexem no que ainda está na condição), então uma execução repetida depois da trava vencer
 * não muda o resultado.</p>
 *
 * <p>Cada execução deixa log de início e de fim com a duração, e de erro quando falha:
 * antes os jobs não deixavam rastro, e um job parado só aparecia nos dados.</p>
 */
@Slf4j
@Component
public class ExecutorJobs {

    /** Prefixo do nome da trava de cada job. */
    static final String PREFIXO_TRAVA = "job-";

    /** Validade da trava: menor que o intervalo de 15 min, para a execução seguinte nunca ser pulada por trava velha. */
    static final Duration VALIDADE_TRAVA = Duration.ofMinutes(14);

    /** Resultado de um pedido de execução. */
    public enum Resultado { EXECUTADO, PULADO }

    private final TravaDistribuida trava;
    private final Map<String, Runnable> jobs = new LinkedHashMap<>();

    public ExecutorJobs(TravaDistribuida trava,
                        IndicadorHospitalJob indicadores,
                        VisitaExpiracaoJob expiracaoVisitas,
                        VisitaGpsInterrompidoJob gpsInterrompido,
                        FeedbackSemRespostaJob feedbackSemResposta,
                        RetencaoDadosPessoaisJob retencaoDados) {
        this.trava = trava;
        jobs.put(NomeJob.INDICADORES, indicadores::executar);
        jobs.put(NomeJob.EXPIRACAO_VISITAS, expiracaoVisitas::executar);
        jobs.put(NomeJob.GPS_INTERROMPIDO, gpsInterrompido::executar);
        jobs.put(NomeJob.FEEDBACK_SEM_RESPOSTA, feedbackSemResposta::executar);
        jobs.put(NomeJob.RETENCAO_DADOS, retencaoDados::executar);
    }

    /** Nomes aceitos, na ordem de registro. */
    public Set<String> listarNomes() {
        return jobs.keySet();
    }

    /**
     * Executa o job, se nenhuma outra instância estiver com ele.
     *
     * @return vazio se o nome não existe
     * @throws RuntimeException o erro do próprio job, depois de registrado em log, para quem
     *                          disparou (o Cloud Scheduler) tentar de novo
     */
    public Optional<Resultado> executar(String nome) {
        Runnable job = jobs.get(nome);
        if (job == null) {
            return Optional.empty();
        }
        boolean rodou = trava.executar(PREFIXO_TRAVA + nome, VALIDADE_TRAVA, () -> executarMedindoTempo(nome, job));
        if (!rodou) {
            log.info("[Job] {} pulado: outra instância está executando.", nome);
        }
        return Optional.of(rodou ? Resultado.EXECUTADO : Resultado.PULADO);
    }

    private static void executarMedindoTempo(String nome, Runnable job) {
        long inicioEmNanos = System.nanoTime();
        log.info("[Job] {} iniciado.", nome);
        try {
            job.run();
        } catch (RuntimeException e) {
            log.error("[Job] {} falhou depois de {} ms.", nome, calcularMilissegundosDesde(inicioEmNanos), e);
            throw e;
        }
        log.info("[Job] {} concluído em {} ms.", nome, calcularMilissegundosDesde(inicioEmNanos));
    }

    private static long calcularMilissegundosDesde(long inicioEmNanos) {
        return Duration.ofNanos(System.nanoTime() - inicioEmNanos).toMillis();
    }
}
