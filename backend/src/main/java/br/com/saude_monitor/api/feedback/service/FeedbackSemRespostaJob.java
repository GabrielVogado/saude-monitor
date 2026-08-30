package br.com.saude_monitor.api.feedback.service;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Job agendado de encerramento do feedback pós-saída sem resposta (RN-09): marca
 * {@code SEM_FEEDBACK} as visitas {@code FINALIZADA} cuja janela de 24h expirou sem
 * feedback (após o lembrete único). Executa a cada 15min, mesmo padrão de
 * {@link br.com.saude_monitor.api.visita.service.VisitaExpiracaoJob}.
 */
@Component
@RequiredArgsConstructor
public class FeedbackSemRespostaJob {

    private final FeedbackService feedbackService;

    @Scheduled(fixedRate = 15 * 60 * 1000L)
    public void executar() {
        feedbackService.processarSemResposta();
    }
}
