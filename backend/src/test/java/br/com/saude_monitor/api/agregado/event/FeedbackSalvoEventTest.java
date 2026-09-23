package br.com.saude_monitor.api.agregado.event;

import br.com.saude_monitor.api.feedback.dto.FeedbackRequest;
import br.com.saude_monitor.api.feedback.document.FoiAtendido;
import br.com.saude_monitor.api.feedback.repository.FeedbackRepository;
import br.com.saude_monitor.api.feedback.service.impl.FeedbackServiceImpl;
import br.com.saude_monitor.api.visita.document.StatusVisita;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import br.com.saude_monitor.api.visita.repository.VisitaRepository;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Verifica que o {@link FeedbackServiceImpl} publica o {@link FeedbackSalvoEvent} após salvar
 * um feedback (Épico 04, RN-18) — disparando o recálculo assíncrono do agregado.
 */
class FeedbackSalvoEventTest {

    private final FeedbackRepository feedbackRepository = mock(FeedbackRepository.class);
    private final VisitaRepository visitaRepository = mock(VisitaRepository.class);
    private final ApplicationEventPublisher publisher = mock(ApplicationEventPublisher.class);
    private final FeedbackServiceImpl service =
            new FeedbackServiceImpl(feedbackRepository, visitaRepository, publisher);

    private VisitaDocument visitaFinalizada(String id, String hospitalId) {
        return VisitaDocument.builder().id(id).hospitalId(hospitalId).status(StatusVisita.FINALIZADA).build();
    }

    private FeedbackRequest request(String visitaId) {
        return new FeedbackRequest(
                visitaId, FoiAtendido.SIM, null, null, null, null, null, 5, null, null);
    }

    @Test
    void devePublicarEventoAoCriarFeedback() {
        when(visitaRepository.findById("v1")).thenReturn(Optional.of(visitaFinalizada("v1", "hosp-1")));
        when(feedbackRepository.existsByVisitaId("v1")).thenReturn(false);
        when(feedbackRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.criar(request("v1"), "u1");

        verify(publisher).publishEvent(new FeedbackSalvoEvent("hosp-1"));
    }

    @Test
    void naoDevePublicarEventoQuandoFeedbackJaExiste() {
        when(visitaRepository.findById("v1")).thenReturn(Optional.of(visitaFinalizada("v1", "hosp-1")));
        when(feedbackRepository.existsByVisitaId("v1")).thenReturn(true); // dedupe (RN-12)

        try {
            service.criar(request("v1"), "u1");
        } catch (Exception ignored) {
            // ConflitoException esperada pelo dedupe
        }

        verify(publisher, never()).publishEvent(any());
    }
}
