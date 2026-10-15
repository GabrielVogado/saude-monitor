package br.com.saude_monitor.api.feedback.service.impl;

import br.com.saude_monitor.api.config.exception.AcessoNegadoException;
import br.com.saude_monitor.api.config.exception.ConflitoException;
import br.com.saude_monitor.api.config.exception.RecursoNaoEncontradoException;
import br.com.saude_monitor.api.feedback.document.FeedbackDocument;
import br.com.saude_monitor.api.feedback.dto.FeedbackPendenteResponse;
import br.com.saude_monitor.api.feedback.dto.FeedbackRequest;
import br.com.saude_monitor.api.feedback.repository.FeedbackRepository;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.visita.document.StatusVisita;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import br.com.saude_monitor.api.visita.repository.VisitaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DuplicateKeyException;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
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
    private final HospitalRepository hospitalRepository = mock(HospitalRepository.class);
    private final ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
    private final FeedbackServiceImpl service =
            new FeedbackServiceImpl(feedbackRepository, visitaRepository, hospitalRepository, eventPublisher);

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

    @Test
    void buscarPorVisitaDeOutroUsuarioLancaAcessoNegado() {
        // Achado F-02 do pentest de 23/09/2026: o chamador está autenticado (endpoint 🔒)
        // — só não é dono deste feedback. 403 (ACESSO_NEGADO), não 401.
        FeedbackDocument feedbackDeOutro = FeedbackDocument.builder()
                .id("f1")
                .visitaId("v1")
                .usuarioId("dono-legitimo")
                .build();
        when(feedbackRepository.findByVisitaId("v1")).thenReturn(Optional.of(feedbackDeOutro));

        assertThatThrownBy(() -> service.buscarPorVisita("v1", "invasor"))
                .isInstanceOf(AcessoNegadoException.class);
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
                .thenReturn(Optional.of(visitaEncerradaHa("v1", StatusVisita.FINALIZADA, Duration.ofMinutes(30))));
        when(feedbackRepository.existsByVisitaId("v1")).thenReturn(false);
        when(feedbackRepository.save(any())).thenThrow(new DuplicateKeyException("chave duplicada"));

        assertThatThrownBy(() -> service.criar(request("v1"), "u1"))
                .isInstanceOf(ConflitoException.class)
                .hasMessageContaining("já avaliou");
    }

    // ------------------------------------------------ feedback pendente (celular descarregado) ------------------

    private VisitaDocument visitaEncerradaHa(String id, StatusVisita status, Duration ha) {
        return VisitaDocument.builder()
                .id(id)
                .hospitalId("h1")
                .status(status)
                .saida(Instant.now().minus(ha))
                .duracaoMinutos(40)
                .build();
    }

    /**
     * Celular descarregado dentro do hospital: o backend encerra a visita como
     * GPS_INTERROMPIDO (RN-06). Antes só FINALIZADA aceitava feedback, então a pessoa
     * perdia a avaliação justamente quando o aparelho morreu.
     */
    @Test
    void criarAceitaVisitaEncerradaPorGpsInterrompido() {
        when(visitaRepository.findById("v1"))
                .thenReturn(Optional.of(visitaEncerradaHa("v1", StatusVisita.GPS_INTERROMPIDO, Duration.ofHours(3))));
        when(feedbackRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertThat(service.criar(request("v1"), "u1").visitaId()).isEqualTo("v1");
    }

    @Test
    void criarRecusaVisitaComJanelaDe24hEncerrada() {
        when(visitaRepository.findById("v1"))
                .thenReturn(Optional.of(visitaEncerradaHa("v1", StatusVisita.GPS_INTERROMPIDO, Duration.ofHours(25))));

        assertThatThrownBy(() -> service.criar(request("v1"), "u1"))
                .isInstanceOf(RecursoNaoEncontradoException.class)
                .hasMessageContaining("24 horas");
        verify(feedbackRepository, never()).save(any());
    }

    @Test
    void criarRecusaVisitaAindaEmAndamento() {
        when(visitaRepository.findById("v1"))
                .thenReturn(Optional.of(visitaEncerradaHa("v1", StatusVisita.EM_ATENDIMENTO, Duration.ZERO)));

        assertThatThrownBy(() -> service.criar(request("v1"), "u1"))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void pendentesDevolveSoVisitasSemFeedbackComNomeDoHospitalEPrazo() {
        VisitaDocument respondida = visitaEncerradaHa("v1", StatusVisita.FINALIZADA, Duration.ofHours(1));
        VisitaDocument pendente = visitaEncerradaHa("v2", StatusVisita.GPS_INTERROMPIDO, Duration.ofHours(2));
        VisitaDocument curta = visitaEncerradaHa("v3", StatusVisita.FINALIZADA, Duration.ofHours(1));
        curta.setDuracaoMinutos(1);
        when(visitaRepository.findByUsuarioIdAndStatusInAndSaidaAfterOrderBySaidaDesc(
                eq("u1"), eq(List.of(StatusVisita.FINALIZADA, StatusVisita.GPS_INTERROMPIDO)), any()))
                .thenReturn(List.of(respondida, pendente, curta));
        when(feedbackRepository.findByVisitaIdIn(List.of("v1", "v2")))
                .thenReturn(List.of(FeedbackDocument.builder().visitaId("v1").build()));
        when(hospitalRepository.findAllById(List.of("h1")))
                .thenReturn(List.of(HospitalDocument.builder().id("h1").nome("HRAN").build()));

        List<FeedbackPendenteResponse> pendentes = service.pendentes("u1");

        assertThat(pendentes).singleElement().satisfies(p -> {
            assertThat(p.visitaId()).isEqualTo("v2");
            assertThat(p.hospitalNome()).isEqualTo("HRAN");
            assertThat(p.prazo()).isEqualTo(pendente.getSaida().plus(Duration.ofHours(24)));
        });
    }

    @Test
    void pendentesSemCandidatasNaoConsultaFeedbacksNemHospitais() {
        when(visitaRepository.findByUsuarioIdAndStatusInAndSaidaAfterOrderBySaidaDesc(any(), any(), any()))
                .thenReturn(List.of());

        assertThat(service.pendentes("u1")).isEmpty();
        verify(feedbackRepository, never()).findByVisitaIdIn(any());
        verify(hospitalRepository, never()).findAllById(any());
    }

    @Test
    void pendentesToleraHospitalSemNome() {
        VisitaDocument pendente = visitaEncerradaHa("v1", StatusVisita.FINALIZADA, Duration.ofHours(1));
        when(visitaRepository.findByUsuarioIdAndStatusInAndSaidaAfterOrderBySaidaDesc(any(), any(), any()))
                .thenReturn(List.of(pendente));
        when(feedbackRepository.findByVisitaIdIn(any())).thenReturn(List.of());
        when(hospitalRepository.findAllById(List.of("h1")))
                .thenReturn(List.of(HospitalDocument.builder().id("h1").nome(null).build()));

        assertThat(service.pendentes("u1")).singleElement()
                .satisfies(p -> assertThat(p.hospitalNome()).isNull());
    }
}
