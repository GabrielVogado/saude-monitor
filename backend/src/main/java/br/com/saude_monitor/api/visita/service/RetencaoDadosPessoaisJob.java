package br.com.saude_monitor.api.visita.service;

import br.com.saude_monitor.api.feedback.service.FeedbackService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.function.LongSupplier;

/**
 * Retenção de dados pessoais de visita e feedback (DAD-01 da Análise de Escalabilidade e
 * Segurança v1.0): uma vez por dia, desvincula de conta e aparelho o que passou de 90 dias.
 * A operação é idempotente (só pega o que ainda tem vínculo), então rodar duas vezes, ou em
 * duas instâncias, não muda o resultado.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RetencaoDadosPessoaisJob {

    private final VisitaService visitaService;
    private final FeedbackService feedbackService;

    @Scheduled(cron = "0 30 3 * * *", zone = "America/Sao_Paulo")
    public void executar() {
        // Cada passo isolado: a falha de um não pode deixar os outros sem rodar.
        executarEtapa("pontos de GPS apagados de visitas encerradas", visitaService::apagarPontosDeVisitasEncerradas);
        executarEtapa("visitas desvinculadas após 90 dias", visitaService::desvincularVisitasAntigas);
        executarEtapa("feedbacks desvinculados após 90 dias", feedbackService::desvincularFeedbacksAntigos);
    }

    private void executarEtapa(String descricao, LongSupplier passo) {
        try {
            log.info("Retenção (DAD-01): {} {}.", passo.getAsLong(), descricao);
        } catch (RuntimeException e) {
            log.error("Retenção (DAD-01) falhou em: {}.", descricao, e);
        }
    }
}
