package br.com.saude_monitor.api.visita.service;

import br.com.saude_monitor.api.feedback.service.FeedbackService;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RetencaoDadosPessoaisJobTest {

    @Test
    void desvinculaVisitasEFeedbacksAntigos() {
        VisitaService visitaService = mock(VisitaService.class);
        FeedbackService feedbackService = mock(FeedbackService.class);

        new RetencaoDadosPessoaisJob(visitaService, feedbackService).executar();

        verify(visitaService).apagarPontosDeVisitasEncerradas();
        verify(visitaService).desvincularVisitasAntigas();
        verify(feedbackService).desvincularFeedbacksAntigos();
    }

    @Test
    void falhaNumaEtapaNaoImpedeAsOutras() {
        VisitaService visitaService = mock(VisitaService.class);
        FeedbackService feedbackService = mock(FeedbackService.class);
        when(visitaService.desvincularVisitasAntigas()).thenThrow(new IllegalStateException("Mongo fora"));

        new RetencaoDadosPessoaisJob(visitaService, feedbackService).executar();

        verify(feedbackService).desvincularFeedbacksAntigos();
    }
}
