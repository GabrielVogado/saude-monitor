package br.com.saude_monitor.api.feedback.service.impl;

import br.com.saude_monitor.api.config.exception.ConflitoException;
import br.com.saude_monitor.api.feedback.document.FeedbackDocument;
import br.com.saude_monitor.api.feedback.dto.FeedbackRequest;
import br.com.saude_monitor.api.feedback.repository.FeedbackRepository;
import br.com.saude_monitor.api.visita.document.StatusVisita;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import br.com.saude_monitor.api.visita.repository.VisitaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DuplicateKeyException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link FeedbackServiceImpl#processarSemResposta()} (job de 15min, RN-09) — não
 * existia teste unitário dedicado para esta classe até 09/09/2026.
 */
class FeedbackServiceImplTest {

    private final FeedbackRepository feedbackRepository = mock(FeedbackRepository.class);
    private final VisitaRepository visitaRepository = mock(VisitaRepository.class);
    private final ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
    private final FeedbackServiceImpl service =
            new FeedbackServiceImpl(feedbackRepository, visitaRepository, eventPublisher);

    private VisitaDocument visitaFinalizada(String id) {
        return VisitaDocument.builder()
                .id(id)
                .status(StatusVisita.FINALIZADA)
                .saida(Instant.now().minus(java.time.Duration.ofHours(25)))
                .build();
    }

    @BeforeEach
    void setup() {
        when(visitaRepository.findByStatusAndSaidaBefore(any(), any())).thenReturn(List.of());
        when(feedbackRepository.findByVisitaIdIn(any())).thenReturn(List.of());
    }

    /**
     * Antes chamava `existsByVisitaId` dentro de um loop (N+1) e salvava a lista
     * inteira, inclusive quem já tinha feedback e não mudou. Este teste falha se o N+1
     * voltar (verifica UMA chamada em lote, nunca `existsByVisitaId`) e se o `saveAll`
     * voltar a incluir visitas que não deveriam mudar de status.
     */
    @Test
    void processarSemRespostaMarcaSoQuemNaoTemFeedbackEmUmaUnicaConsultaEmLote() {
        VisitaDocument comFeedback = visitaFinalizada("v1");
        VisitaDocument semFeedback = visitaFinalizada("v2");
        when(visitaRepository.findByStatusAndSaidaBefore(any(), any()))
                .thenReturn(List.of(comFeedback, semFeedback));
        when(feedbackRepository.findByVisitaIdIn(any()))
                .thenReturn(List.of(FeedbackDocument.builder().visitaId("v1").build()));

        service.processarSemResposta();

        assertThat(comFeedback.getStatus()).isEqualTo(StatusVisita.FINALIZADA);
        assertThat(semFeedback.getStatus()).isEqualTo(StatusVisita.SEM_FEEDBACK);
        verify(visitaRepository).saveAll(List.of(semFeedback));
        verify(feedbackRepository, never()).existsByVisitaId(anyString());
    }

    @Test
    void processarSemRespostaSemCandidatosNaoChamaFeedbackRepository() {
        service.processarSemResposta();

        verify(feedbackRepository).findByVisitaIdIn(List.of());
        verify(visitaRepository).saveAll(List.of());
    }

    // ------------------------------------------------ criar (achado do code-review, 09/09/2026) ------------------

    private FeedbackRequest request(String visitaId) {
        return new FeedbackRequest(visitaId, null, null, null, null, null, null, 4, null, null);
    }

    /**
     * `existsByVisitaId` (checagem em memória) e `save` (índice único no Mongo) não são
     * atômicos: um retry do cliente em 502/503/504 pode chegar enquanto a tentativa
     * original ainda processa, e os dois passam pela checagem antes de qualquer um
     * salvar. Sem tratar `DuplicateKeyException`, isso vazava como 500 genérico em vez
     * do 409 "Você já avaliou esta visita" que o frontend já trata como sucesso.
     */
    @Test
    void criarConvertDuplicateKeyExceptionEmConflito() {
        when(visitaRepository.findById("v1"))
                .thenReturn(Optional.of(visitaFinalizada("v1")));
        when(feedbackRepository.existsByVisitaId("v1")).thenReturn(false);
        when(feedbackRepository.save(any())).thenThrow(new DuplicateKeyException("chave duplicada"));

        assertThatThrownBy(() -> service.criar(request("v1"), "u1"))
                .isInstanceOf(ConflitoException.class)
                .hasMessageContaining("já avaliou");
    }
}
