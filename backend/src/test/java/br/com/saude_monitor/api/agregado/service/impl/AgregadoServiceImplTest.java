package br.com.saude_monitor.api.agregado.service.impl;

import br.com.saude_monitor.api.agregado.document.AgregadoHospitalDocument;
import br.com.saude_monitor.api.agregado.repository.AgregadoHospitalRepository;
import br.com.saude_monitor.api.agregado.service.AgregadoService;
import br.com.saude_monitor.api.feedback.document.FeedbackDocument;
import br.com.saude_monitor.api.feedback.repository.FeedbackRepository;
import br.com.saude_monitor.api.hospital.dto.IndicadoresResponse;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.visita.document.StatusVisita;
import br.com.saude_monitor.api.visita.document.TipoPermanencia;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import br.com.saude_monitor.api.visita.repository.VisitaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Testes do {@link AgregadoServiceImpl} (Épico 04) — regras de agregação RN-14..RN-17,
 * RN-15 (N ≥ 5) e exibição embutida/enriquecida.
 */
class AgregadoServiceImplTest {

    private final AgregadoHospitalRepository agregadoRepository = mock(AgregadoHospitalRepository.class);
    private final FeedbackRepository feedbackRepository = mock(FeedbackRepository.class);
    private final VisitaRepository visitaRepository = mock(VisitaRepository.class);
    private final HospitalRepository hospitalRepository = mock(HospitalRepository.class);
    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final AgregadoService service =
            new AgregadoServiceImpl(agregadoRepository, feedbackRepository, visitaRepository, hospitalRepository, mongoTemplate);

    @BeforeEach
    void setup() {
        when(feedbackRepository.findByHospitalIdAndCriadoEmAfterAndNotaNotNull(eq("h1"), any())).thenReturn(List.of());
        when(visitaRepository.findByHospitalIdAndStatusInAndSaidaBetweenAndTipoPermanencia(
                eq("h1"), any(), any(), any(), any())).thenReturn(List.of());
    }

    private FeedbackDocument feedback(String hosp, int nota) {
        return FeedbackDocument.builder().hospitalId(hosp).nota(nota).build();
    }

    // ------------------------------------------------ RN-14/RN-15 (média + N) ---------------------------------------

    @Test
    void recalcularCalculaNotaMediaENAvaliacoes() {
        when(feedbackRepository.findByHospitalIdAndCriadoEmAfterAndNotaNotNull(eq("h1"), any()))
                .thenReturn(List.of(feedback("h1", 4), feedback("h1", 5), feedback("h1", 3)));

        AgregadoHospitalDocument agregado = service.recalcular("h1");

        assertThat(agregado.getNotaMedia()).isEqualTo(4.0);
        assertThat(agregado.getNAvaliacoes()).isEqualTo(3);
        assertThat(agregado.getHospitalId()).isEqualTo("h1");
        assertThat(agregado.getPeriodoInicio()).isNotNull();
        assertThat(agregado.getPeriodoFim()).isNotNull();
        verify(mongoTemplate).upsert(any(), any(), eq(AgregadoHospitalDocument.class));
    }

    @Test
    void recalcularIgnoraFeedbacksSemNotaDefinida() {
        // Um feedback sem nota (nota null) não conta para média nem N.
        FeedbackDocument semNota = FeedbackDocument.builder().hospitalId("h1").nota(null).build();
        when(feedbackRepository.findByHospitalIdAndCriadoEmAfterAndNotaNotNull(any(), any()))
                .thenReturn(List.of(feedback("h1", 5), semNota));

        AgregadoHospitalDocument agregado = service.recalcular("h1");
        // A query já filtra nota != null; defensivamente o serviço também ignora sem nota.
        assertThat(agregado.getNAvaliacoes()).isEqualTo(1);
        assertThat(agregado.getNotaMedia()).isEqualTo(5.0);
    }

    // ------------------------------------------------ RN-16 (mediana do tempo) --------------------------------------

    private VisitaDocument visitaFinalizada(int minutos) {
        return VisitaDocument.builder()
                .hospitalId("h1")
                .status(StatusVisita.FINALIZADA)
                .tipoPermanencia(TipoPermanencia.ATENDIMENTO)
                .duracaoMinutos(minutos)
                .build();
    }

    @Test
    void recalcularCalculaMedianaDoTempo() {
        when(visitaRepository.findByHospitalIdAndStatusInAndSaidaBetweenAndTipoPermanencia(
                eq("h1"), any(), any(), any(), any()))
                .thenReturn(List.of(visitaFinalizada(30), visitaFinalizada(120), visitaFinalizada(60), visitaFinalizada(90)));

        AgregadoHospitalDocument agregado = service.recalcular("h1");
        assertThat(agregado.getTempoMedianoMinutos()).isEqualTo(75); // (60+90)/2
        assertThat(agregado.getNVisitas()).isEqualTo(4);
    }

    @Test
    void recalcularExcluiVisitassAcimaDe24h() {
        // 25h (1500min) excede o teto de 24h (RN-16) — sai da métrica.
        when(visitaRepository.findByHospitalIdAndStatusInAndSaidaBetweenAndTipoPermanencia(
                eq("h1"), any(), any(), any(), any()))
                .thenReturn(List.of(visitaFinalizada(60), visitaFinalizada(1500)));

        AgregadoHospitalDocument agregado = service.recalcular("h1");
        assertThat(agregado.getNVisitas()).isEqualTo(1);
        assertThat(agregado.getTempoMedianoMinutos()).isEqualTo(60);
    }

    @Test
    void recalcularExcluiVisitasSemDuracao() {
        VisitaDocument semDuracao = VisitaDocument.builder()
                .hospitalId("h1").status(StatusVisita.FINALIZADA)
                .tipoPermanencia(TipoPermanencia.ATENDIMENTO).duracaoMinutos(null).build();
        when(visitaRepository.findByHospitalIdAndStatusInAndSaidaBetweenAndTipoPermanencia(
                eq("h1"), any(), any(), any(), any()))
                .thenReturn(List.of(visitaFinalizada(45), semDuracao));

        AgregadoHospitalDocument agregado = service.recalcular("h1");
        assertThat(agregado.getNVisitas()).isEqualTo(1);
        assertThat(agregado.getTempoMedianoMinutos()).isEqualTo(45);
    }

    @Test
    void recalcularSemVisitasElegiveisDeixaTempoNulo() {
        AgregadoHospitalDocument agregado = service.recalcular("h1");
        assertThat(agregado.getTempoMedianoMinutos()).isNull();
        assertThat(agregado.getNVisitas()).isZero();
    }

    // ------------------------------------------------ RN-17 (cobertura GPS) ----------------------------------------

    private VisitaDocument visitaGpsInterrompido(Instant entrada, Instant saida, Instant ultimaPosicao) {
        return VisitaDocument.builder()
                .hospitalId("h1")
                .status(StatusVisita.GPS_INTERROMPIDO)
                .tipoPermanencia(TipoPermanencia.ATENDIMENTO)
                .entrada(entrada)
                .saida(saida)
                .ultimaPosicaoEm(ultimaPosicao)
                .duracaoMinutos((int) java.time.Duration.between(entrada, saida).toMinutes())
                .build();
    }

    @Test
    void visitaGpsInterrompidoEntraComCoberturaSuficiente() {
        Instant entrada = Instant.parse("2026-08-01T10:00:00Z");
        Instant saida = Instant.parse("2026-08-01T11:00:00Z");      // 60min
        Instant posicao = Instant.parse("2026-08-01T10:54:00Z");     // 54/60 = 90% → entra (RN-17)
        when(visitaRepository.findByHospitalIdAndStatusInAndSaidaBetweenAndTipoPermanencia(
                eq("h1"), any(), any(), any(), any()))
                .thenReturn(List.of(visitaGpsInterrompido(entrada, saida, posicao)));

        AgregadoHospitalDocument agregado = service.recalcular("h1");
        assertThat(agregado.getNVisitas()).isEqualTo(1);
        assertThat(agregado.getTempoMedianoMinutos()).isEqualTo(60);
    }

    @Test
    void visitaGpsInterrompidoSaiComCoberturaInsuficiente() {
        Instant entrada = Instant.parse("2026-08-01T10:00:00Z");
        Instant saida = Instant.parse("2026-08-01T11:00:00Z");      // 60min
        Instant posicao = Instant.parse("2026-08-01T10:20:00Z");     // 20/60 ≈ 33% → NÃO entra (RN-17)
        when(visitaRepository.findByHospitalIdAndStatusInAndSaidaBetweenAndTipoPermanencia(
                eq("h1"), any(), any(), any(), any()))
                .thenReturn(List.of(visitaGpsInterrompido(entrada, saida, posicao)));

        AgregadoHospitalDocument agregado = service.recalcular("h1");
        assertThat(agregado.getNVisitas()).isZero();
        assertThat(agregado.getTempoMedianoMinutos()).isNull();
    }

    // ------------------------------------------------ RN-15 (exibição N ≥ 5) ----------------------------------------

    @Test
    void mapaIndicadoresOmiteValoresQuandoNAbaixoDe5() {
        AgregadoHospitalDocument a = AgregadoHospitalDocument.builder()
                .hospitalId("h1").notaMedia(4.0).nAvaliacoes(3).tempoMedianoMinutos(60).build();
        when(agregadoRepository.findByHospitalIdIn(List.of("h1", "h2")))
                .thenReturn(List.of(a));

        List<IndicadoresResponse> mapa = service.mapaIndicadores(List.of("h1", "h2"));

        assertThat(mapa).hasSize(2);
        assertThat(mapa.get(0).indicadoresDisponiveis()).isFalse();
        assertThat(mapa.get(0).notaMedia()).isNull();
        assertThat(mapa.get(0).tempoMedianoMinutos()).isNull();
        assertThat(mapa.get(0).nAvaliacoes()).isEqualTo(3);
        // h2 sem agregado → indisponível
        assertThat(mapa.get(1).indicadoresDisponiveis()).isFalse();
    }

    @Test
    void mapaIndicadoresExibeValoresQuandoNMaiorIgual5() {
        AgregadoHospitalDocument a = AgregadoHospitalDocument.builder()
                .hospitalId("h1").notaMedia(4.2).nAvaliacoes(12).tempoMedianoMinutos(95).build();
        when(agregadoRepository.findByHospitalIdIn(List.of("h1"))).thenReturn(List.of(a));

        IndicadoresResponse res = service.mapaIndicadores(List.of("h1")).getFirst();
        assertThat(res.indicadoresDisponiveis()).isTrue();
        assertThat(res.notaMedia()).isEqualTo(4.2);
        assertThat(res.tempoMedianoMinutos()).isEqualTo(95);
        assertThat(res.nAvaliacoes()).isEqualTo(12);
    }

    // ------------------------------------------------ §3.5 (detalhe enriquecido) -----------------------------------

    @Test
    void obterDetalheRetornaIndisponivelQuandoHospitalNaoExiste() {
        when(hospitalRepository.existsById("x")).thenReturn(false);
        assertThat(service.obterDetalhe("x")).isNull();
    }

    @Test
    void obterDetalheRetornaPeriodoEVisitas() {
        when(hospitalRepository.existsById("h1")).thenReturn(true);
        AgregadoHospitalDocument a = AgregadoHospitalDocument.builder()
                .hospitalId("h1").notaMedia(4.0).nAvaliacoes(7).tempoMedianoMinutos(80).nVisitas(34)
                .periodoInicio(Instant.parse("2026-05-10T00:00:00Z"))
                .periodoFim(Instant.parse("2026-08-07T23:59:59Z"))
                .build();
        when(agregadoRepository.findByHospitalId("h1")).thenReturn(Optional.of(a));

        var detalhe = service.obterDetalhe("h1");
        assertThat(detalhe.indicadoresDisponiveis()).isTrue();
        assertThat(detalhe.nVisitas()).isEqualTo(34);
        assertThat(detalhe.periodo().inicio()).isEqualTo(Instant.parse("2026-05-10T00:00:00Z"));
        assertThat(detalhe.periodo().fim()).isEqualTo(Instant.parse("2026-08-07T23:59:59Z"));
    }
}
