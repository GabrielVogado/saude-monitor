package br.com.saude_monitor.api.indicador.service.impl;

import br.com.saude_monitor.api.indicador.event.FeedbackSalvoEvent;
import br.com.saude_monitor.api.indicador.service.IndicadorService;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Ouvinte do {@link FeedbackSalvoEvent}: recalcula o indicador do hospital e, se o
 * recálculo falhar, não propaga o erro (o job de 15min cobre a falha — RN-18).
 */
class FeedbackSalvoEventListenerTest {

    private final IndicadorService indicadorService = mock(IndicadorService.class);
    private final FeedbackSalvoEventListener listener = new FeedbackSalvoEventListener(indicadorService);

    @Test
    void recalculaOIndicadorDoHospitalDoEvento() {
        listener.aoSalvarFeedback(new FeedbackSalvoEvent("hosp-1"));

        verify(indicadorService).recalcular("hosp-1");
    }

    @Test
    void naoPropagaFalhaDoRecalculo() {
        when(indicadorService.recalcular("hosp-1")).thenThrow(new IllegalStateException("Mongo fora"));

        assertThatCode(() -> listener.aoSalvarFeedback(new FeedbackSalvoEvent("hosp-1")))
                .doesNotThrowAnyException();
        verify(indicadorService).recalcular("hosp-1");
    }
}
