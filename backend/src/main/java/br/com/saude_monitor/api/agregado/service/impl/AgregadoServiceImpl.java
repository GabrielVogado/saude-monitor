package br.com.saude_monitor.api.agregado.service.impl;

import br.com.saude_monitor.api.agregado.document.AgregadoHospitalDocument;
import br.com.saude_monitor.api.agregado.dto.IndicadoresDetalheResponse;
import br.com.saude_monitor.api.agregado.repository.AgregadoHospitalRepository;
import br.com.saude_monitor.api.agregado.service.AgregadoService;
import br.com.saude_monitor.api.agregado.service.EstatisticaService;
import br.com.saude_monitor.api.feedback.document.FeedbackDocument;
import br.com.saude_monitor.api.feedback.repository.FeedbackRepository;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.dto.IndicadoresResponse;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.visita.document.StatusVisita;
import br.com.saude_monitor.api.visita.document.TipoPermanencia;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import br.com.saude_monitor.api.visita.repository.VisitaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Implementação do serviço de agregação de indicadores públicos (Épico 04 / F-06).
 *
 * <p>Regras aplicadas (RN-14..RN-18):</p>
 * <ul>
 *   <li><b>notaMedia</b> — média aritmética das notas dos feedbacks do hospital nos
 *       últimos 90 dias (RN-14);</li>
 *   <li><b>nAvaliacoes</b> — quantidade de feedbacks na janela; exibir apenas se ≥ 5 (RN-15);</li>
 *   <li><b>tempoMedianoMinutos</b> — mediana das durações de visitas elegíveis na janela,
 *       considerando apenas visitas com duração entre 2min e 24h e com
 *       {@code tipoPermanencia = ATENDIMENTO} (exclui {@code INTERNACAO}/{@code OBSERVACAO} —
 *       RN-16/RN-24); durações < 2min são ruído e ficam de fora (RN-07); visitas
 *       {@code GPS_INTERROMPIDO} entram apenas se a cobertura de GPS ≥ 90% (RN-17);</li>
 *   <li><b>{@code atualizadoEm}</b> — atualização ≤ 15min após feedback, via evento
 *       (RN-18) e job de 15min.</li>
 * </ul>
 *
 * <p>O upsert é idempotente por {@code hospitalId} (índice único) e o mapeamento da
 * listagem/detalhe público é feito em lote ({@code findByHospitalIdIn}) para evitar N+1.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgregadoServiceImpl implements AgregadoService {

    /** Janela padrão do período dos indicadores (RN-14): últimos 90 dias. */
    static final Duration PERIODO_PADRAO = Duration.ofDays(90);

    /** Teto de duração para a métrica de tempo (RN-16): visitas de até 24h. */
    static final int TETO_DURACAO_MINUTOS = 24 * 60;

    /** Piso de duração para a métrica de tempo (RN-07): visitas com menos de 2 minutos são ruído e não entram nas estatísticas públicas. */
    static final int DURACAO_MINIMA_MINUTOS = 2;

    /** Percentual mínimo de cobertura de GPS para visitas {@code GPS_INTERROMPIDO} (RN-17). */
    static final double COBERTURA_GPS_MINIMA = 0.90;

    /** Status válidos de visita para o indicador de tempo: FINALIZADA (RN-03) e GPS_INTERROMPIDO (RN-06, com cobertura ≥ 90% — RN-17). */
    private static final List<StatusVisita> STATUS_TEMPO = List.of(
            StatusVisita.FINALIZADA,
            StatusVisita.GPS_INTERROMPIDO);

    private final AgregadoHospitalRepository agregadoRepository;
    private final FeedbackRepository feedbackRepository;
    private final VisitaRepository visitaRepository;
    private final HospitalRepository hospitalRepository;
    private final MongoTemplate mongoTemplate;

    @Override
    public AgregadoHospitalDocument recalcular(String hospitalId) {
        Instant fim = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        Instant inicio = fim.minus(PERIODO_PADRAO);

        List<FeedbackDocument> feedbacks = feedbackRepository
                .findByHospitalIdAndCriadoEmAfterAndNotaNotNull(hospitalId, inicio);

        List<Integer> notas = feedbacks.stream()
                .map(FeedbackDocument::getNota)
                .toList();
        Double notaMedia = EstatisticaService.notaMedia(notas);
        int nAvaliacoes = (int) feedbacks.stream()
                .filter(f -> f.getNota() != null && f.getNota() >= 1 && f.getNota() <= 5)
                .count();

        // Visitas elegíveis para o indicador de tempo: FINALIZADA | GPS_INTERROMPIDO,
        // no período, com tipoPermanencia ATENDIMENTO (exclui internação/observação, RN-24).
        List<VisitaDocument> candidatas = visitaRepository
                .findByHospitalIdAndStatusInAndSaidaBetweenAndTipoPermanencia(
                        hospitalId, STATUS_TEMPO, inicio, fim, TipoPermanencia.ATENDIMENTO);

        List<Integer> duracoes = candidatas.stream()
                .filter(v -> v.getDuracaoMinutos() != null)
                .filter(v -> v.getDuracaoMinutos() >= DURACAO_MINIMA_MINUTOS)
                .filter(v -> v.getDuracaoMinutos() <= TETO_DURACAO_MINUTOS)
                .filter(AgregadoServiceImpl::tempoConfiável)
                .map(VisitaDocument::getDuracaoMinutos)
                .toList();

        Integer tempoMediano = EstatisticaService.tempoMedianoMinutos(duracoes);
        int nVisitas = duracoes.size();

        AgregadoHospitalDocument agregado = AgregadoHospitalDocument.builder()
                .hospitalId(hospitalId)
                .notaMedia(notaMedia)
                .nAvaliacoes(nAvaliacoes)
                .tempoMedianoMinutos(tempoMediano)
                .nVisitas(nVisitas)
                .periodoInicio(inicio)
                .periodoFim(fim)
                .atualizadoEm(fim)
                .build();

        persistir(agregado);
        return agregado;
    }

    @Override
    public List<IndicadoresResponse> mapaIndicadores(Collection<String> hospitalIds) {
        if (hospitalIds == null || hospitalIds.isEmpty()) {
            return List.of();
        }
        Map<String, AgregadoHospitalDocument> porHospital = agregadoRepository
                .findByHospitalIdIn(hospitalIds)
                .stream()
                .collect(Collectors.toMap(AgregadoHospitalDocument::getHospitalId, a -> a));

        return hospitalIds.stream()
                .map(id -> porHospital.containsKey(id)
                        ? toIndicadoresResponse(porHospital.get(id))
                        : IndicadoresResponse.indisponivel())
                .toList();
    }

    @Override
    public IndicadoresDetalheResponse obterDetalhe(String hospitalId) {
        if (!hospitalRepository.existsById(hospitalId)) {
            return null;
        }
        return agregadoRepository.findByHospitalId(hospitalId)
                .map(this::toDetalheResponse)
                .orElseGet(() -> IndicadoresDetalheResponse.indisponivel(hospitalId));
    }

    @Override
    public void recalcularPendentes() {
        // MVP: recalcula todos os hospitais ativos. O volume é pequeno (~340) e as leituras
        // são indexadas; garante a atualização ≤ 15min (RN-18) mesmo quando um evento de
        // feedback falha/atrasa. O evento AFTER_COMMIT já cobre o caminho de baixa latência.
        List<HospitalDocument> ativos = hospitalRepository.findAllByAtivoTrue();
        for (HospitalDocument hospital : ativos) {
            try {
                recalcular(hospital.getId());
            } catch (Exception ex) {
                log.warn("Falha ao recalcular agregado do hospital {}: {}", hospital.getId(), ex.getMessage());
            }
        }
    }

    // ------------------------------------------------------------------
    // RNG / urnas
    // ------------------------------------------------------------------

    /**
     * Visitas FINALIZADA sempre entram (RN-03). Para {@code GPS_INTERROMPIDO} (RN-06),
     * a duração parcial só é confiável se a cobertura de GPS ≥ 90% do período (RN-17).
     */
    private static boolean tempoConfiável(VisitaDocument visita) {
        if (visita.getStatus() == StatusVisita.FINALIZADA) {
            return true;
        }
        if (visita.getStatus() != StatusVisita.GPS_INTERROMPIDO) {
            return false;
        }
        Instant entrada = visita.getEntrada();
        Instant saida = visita.getSaida();
        if (entrada == null || saida == null || !saida.isAfter(entrada)) {
            return false;
        }
        double fracao = EstatisticaService.fracaoCoberta(entrada, saida, visita.getUltimaPosicaoEm());
        return fracao >= COBERTURA_GPS_MINIMA;
    }

    /** Persiste o agregado com upsert idempotente por {@code hospitalId}. */
    private void persistir(AgregadoHospitalDocument agregado) {
        Query query = Query.query(Criteria.where("hospitalId").is(agregado.getHospitalId()));
        Update update = new Update()
                .set("notaMedia", agregado.getNotaMedia())
                .set("nAvaliacoes", agregado.getNAvaliacoes())
                .set("tempoMedianoMinutos", agregado.getTempoMedianoMinutos())
                .set("nVisitas", agregado.getNVisitas())
                .set("periodoInicio", agregado.getPeriodoInicio())
                .set("periodoFim", agregado.getPeriodoFim())
                .set("atualizadoEm", agregado.getAtualizadoEm());

        mongoTemplate.upsert(query, update, AgregadoHospitalDocument.class);
    }

    /** Indicadores embutidos compactos (listagem/detalhe) — omite valores se N < 5 (RN-15). */
    private IndicadoresResponse toIndicadoresResponse(AgregadoHospitalDocument a) {
        boolean disponivel = a.getNAvaliacoes() != null && a.getNAvaliacoes() >= 5;
        return new IndicadoresResponse(
                disponivel,
                disponivel ? a.getNotaMedia() : null,
                a.getNAvaliacoes(),
                disponivel ? a.getTempoMedianoMinutos() : null,
                a.getAtualizadoEm());
    }

    /** Indicadores enriquecidos do endpoint dedicado (§3.5). */
    private IndicadoresDetalheResponse toDetalheResponse(AgregadoHospitalDocument a) {
        boolean disponivel = a.getNAvaliacoes() != null && a.getNAvaliacoes() >= 5;
        var periodo = a.getPeriodoInicio() == null || a.getPeriodoFim() == null
                ? null
                : new IndicadoresDetalheResponse.Periodo(a.getPeriodoInicio(), a.getPeriodoFim());
        return new IndicadoresDetalheResponse(
                a.getHospitalId(),
                disponivel,
                disponivel ? a.getNotaMedia() : null,
                a.getNAvaliacoes(),
                disponivel ? a.getTempoMedianoMinutos() : null,
                a.getNVisitas(),
                periodo,
                a.getAtualizadoEm());
    }
}
