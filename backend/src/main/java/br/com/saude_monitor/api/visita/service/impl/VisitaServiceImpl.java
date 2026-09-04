package br.com.saude_monitor.api.visita.service.impl;

import br.com.saude_monitor.api.config.exception.ConflitoException;
import br.com.saude_monitor.api.config.exception.NaoAutorizadoException;
import br.com.saude_monitor.api.config.exception.RecursoNaoEncontradoException;
import br.com.saude_monitor.api.config.exception.ValidacaoNegocioException;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.dto.PageResponse;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.visita.document.OrigemVisita;
import br.com.saude_monitor.api.visita.document.PontoAmostralDocument;
import br.com.saude_monitor.api.visita.document.StatusVisita;
import br.com.saude_monitor.api.visita.document.TipoPermanencia;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import br.com.saude_monitor.api.visita.dto.CandidatoGeofence;
import br.com.saude_monitor.api.visita.dto.CheckinRequest;
import br.com.saude_monitor.api.visita.dto.CheckinResponse;
import br.com.saude_monitor.api.visita.dto.CheckoutRequest;
import br.com.saude_monitor.api.visita.dto.CheckoutResponse;
import br.com.saude_monitor.api.visita.dto.HeartbeatResponse;
import br.com.saude_monitor.api.visita.dto.PosicaoDto;
import br.com.saude_monitor.api.visita.dto.TipoPermanenciaRequest;
import br.com.saude_monitor.api.visita.dto.TipoPermanenciaResponse;
import br.com.saude_monitor.api.visita.dto.VisitaAtivaResponse;
import br.com.saude_monitor.api.visita.dto.VisitaResponse;
import br.com.saude_monitor.api.visita.repository.VisitaRepository;
import br.com.saude_monitor.api.visita.service.ConflitoGeofenceException;
import br.com.saude_monitor.api.visita.service.VisitaService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Implementação do serviço de visitas (Épico 02 — Detecção de Visitas/Geofence).
 *
 * <p>Responsabilidades: check-in (com validação {@code $geoIntersects} e resolução de
 * conflito de geofences sobrepostos — E2-04/RN-05), checkout, heartbeat (E2-09/RN-23),
 * sinalização de tipo de permanência (E2-10/RN-24) e o job de expiração (E2-03/RN-04).</p>
 */
@Service
@RequiredArgsConstructor
public class VisitaServiceImpl implements VisitaService {

    /** Janela sem heartbeat a partir da qual a visita é marcada SUSPEITA (RN-23). */
    private static final Duration LIMITE_SUSPEITA = Duration.ofHours(2);
    /** Janela sem heartbeat a partir da qual a visita é expirada (RN-04). */
    private static final Duration LIMITE_EXPIRACAO = Duration.ofHours(24);
    /** Duração mínima de visita ativa para habilitar a sinalização de tipo de permanência (RN-24). */
    private static final Duration LIMITE_TIPO_PERMANENCIA = Duration.ofHours(12);
    /** Diferença de distância (m) abaixo da qual dois geofences sobrepostos são considerados empate (E2-04/RN-05). */
    private static final double LIMITE_EMPATE_METROS = 10.0;
    /** Janela sem sinal de posição a partir da qual a visita é encerrada como GPS_INTERROMPIDO (RN-06/E2-05). */
    private static final Duration LIMITE_GPS_INTERROMPIDO = Duration.ofMinutes(10);
    /**
     * Idade máxima aceita para o {@code ocorridoEm} informado pelo aplicativo (OPS-05).
     * É a mesma janela em que a visita expira por falta de sinal de vida (RN-04): um evento
     * mais antigo que isso não reconstrói nada, só criaria registro sem correspondência.
     */
    private static final Duration LIMITE_EVENTO_OFFLINE = Duration.ofHours(24);
    /** Folga para relógio adiantado do aparelho antes de descartar um {@code ocorridoEm} futuro. */
    private static final Duration TOLERANCIA_RELOGIO = Duration.ofMinutes(5);

    private static final List<StatusVisita> STATUS_ATIVOS = List.of(StatusVisita.EM_ATENDIMENTO, StatusVisita.SUSPEITA);

    private final VisitaRepository visitaRepository;
    private final HospitalRepository hospitalRepository;
    private final MongoTemplate mongoTemplate;

    @Override
    public CheckinResponse checkin(CheckinRequest request, String usuarioId) {
        if ((usuarioId == null || usuarioId.isBlank())
                && (request.dispositivoId() == null || request.dispositivoId().isBlank())) {
            throw new ValidacaoNegocioException(
                    "É necessário estar autenticado ou informar dispositivoId para check-in anônimo.");
        }

        String hospitalId = request.origem() == OrigemVisita.GEOFENCE
                ? resolverHospitalPorGeofence(request.hospitalId(), request.posicao())
                : exigirHospitalAtivo(request.hospitalId());

        VisitaDocument existente = usuarioId != null
            ? visitaRepository.findFirstByUsuarioIdAndStatusInOrderByEntradaDesc(
                usuarioId, STATUS_ATIVOS).orElse(null)
            : visitaRepository.findFirstByDispositivoIdAndStatusInOrderByEntradaDesc(
                request.dispositivoId(), STATUS_ATIVOS).orElse(null);

        // Idempotência (RN-03/§3.3): já existe visita ativa no mesmo hospital, retorna a existente (HTTP 200).
        if (existente != null) {
            if (!existente.getHospitalId().equals(hospitalId)) {
            throw new ConflitoException(
                "Você já possui um check-in ativo em outro hospital. Finalize-o antes de iniciar uma nova visita.");
            }
            return new CheckinResponse(existente.getId(), existente.getHospitalId(),
                    existente.getEntrada(), existente.getStatus(), false);
        }

        Instant agora = Instant.now();
        // A entrada é o momento do evento (que pode ter ficado na fila offline, OPS-05);
        // `criadoEm` e o heartbeat são do recebimento, porque é agora que o servidor soube.
        Instant entrada = resolverMomento(request.ocorridoEm(), agora);
        VisitaDocument.VisitaDocumentBuilder builder = VisitaDocument.builder()
                .usuarioId(usuarioId)
                .dispositivoId(request.dispositivoId())
                .hospitalId(hospitalId)
                .entrada(entrada)
                .status(StatusVisita.EM_ATENDIMENTO)
                .tipoPermanencia(TipoPermanencia.ATENDIMENTO)
                .ultimoHeartbeat(agora)
                .origem(request.origem())
                .criadoEm(agora);

        if (request.posicao() != null) {
            builder.pontosAmostrais(List.of(toPontoAmostral(request.posicao(), entrada)));
            builder.ultimaPosicaoEm(entrada);
        }

        VisitaDocument salva = visitaRepository.save(builder.build());
        return new CheckinResponse(salva.getId(), salva.getHospitalId(), salva.getEntrada(), salva.getStatus(), true);
    }

    @Override
    public CheckoutResponse checkout(String id, CheckoutRequest request, String usuarioId) {
        VisitaDocument visita = obterAtivaOu409(id, usuarioId);

        Instant agora = Instant.now();
        boolean gpsIndisponivel = Boolean.TRUE.equals(request.gpsIndisponivel());

        // Saída nunca antes da entrada: um `ocorridoEm` da fila offline com relógio errado
        // produziria duração negativa, que envenenaria a mediana de permanência (RN-15).
        Instant saida = resolverMomento(request.ocorridoEm(), agora);
        if (saida.isBefore(visita.getEntrada())) {
            saida = visita.getEntrada();
        }

        visita.setSaida(saida);
        visita.setDuracaoMinutos((int) Duration.between(visita.getEntrada(), saida).toMinutes());
        visita.setStatus(gpsIndisponivel ? StatusVisita.GPS_INTERROMPIDO : StatusVisita.FINALIZADA);
        if (Boolean.TRUE.equals(request.encerramentoManual())) {
            visita.setEncerramentoManual(true);
        }
        if (request.posicao() != null) {
            visita.getPontosAmostrais().add(toPontoAmostral(request.posicao(), saida));
            visita.setUltimaPosicaoEm(saida);
        }

        VisitaDocument salva = visitaRepository.save(visita);
        return new CheckoutResponse(salva.getId(), salva.getSaida(), salva.getDuracaoMinutos(),
                salva.getStatus(), salva.isEncerramentoManual());
    }

    @Override
    public HeartbeatResponse heartbeat(String id, String usuarioId, PosicaoDto posicao) {
        VisitaDocument visita = obterAtivaOu409(id, usuarioId);

        Instant agora = Instant.now();
        visita.setUltimoHeartbeat(agora);
        if (posicao != null) {
            visita.getPontosAmostrais().add(toPontoAmostral(posicao, agora));
            visita.setUltimaPosicaoEm(agora);
        }
        if (visita.getStatus() == StatusVisita.SUSPEITA) {
            visita.setStatus(StatusVisita.EM_ATENDIMENTO);
        }

        VisitaDocument salva = visitaRepository.save(visita);
        return new HeartbeatResponse(salva.getStatus(), salva.getUltimoHeartbeat());
    }

    @Override
    public TipoPermanenciaResponse sinalizarTipoPermanencia(String id, TipoPermanenciaRequest request, String usuarioId) {
        VisitaDocument visita = obterAtivaOu409(id, usuarioId);

        if (request.tipoPermanencia() == TipoPermanencia.ATENDIMENTO) {
            throw new ValidacaoNegocioException("tipoPermanencia deve ser OBSERVACAO ou INTERNACAO.");
        }
        if (Duration.between(visita.getEntrada(), Instant.now()).compareTo(LIMITE_TIPO_PERMANENCIA) < 0) {
            throw new ValidacaoNegocioException(
                    "A sinalização de tipo de permanência só é permitida após 12h de visita ativa.");
        }

        visita.setTipoPermanencia(request.tipoPermanencia());
        VisitaDocument salva = visitaRepository.save(visita);
        return new TipoPermanenciaResponse(salva.getTipoPermanencia());
    }

    @Override
    public VisitaAtivaResponse buscarAtiva(String usuarioId, String dispositivoId) {
        // Modo anônimo (sem login, §3.3): identifica a visita ativa pelo dispositivo.
        if ((usuarioId == null || usuarioId.isBlank()) && dispositivoId != null && !dispositivoId.isBlank()) {
            return visitaRepository.findFirstByDispositivoIdAndStatusInOrderByEntradaDesc(
                            dispositivoId, STATUS_ATIVOS)
                    .map(this::toResponse)
                    .map(VisitaAtivaResponse::new)
                    .orElse(new VisitaAtivaResponse(null));
        }

        String uid = exigirUsuario(usuarioId);
        return visitaRepository.findFirstByUsuarioIdAndStatusInOrderByEntradaDesc(uid, STATUS_ATIVOS)
                .map(this::toResponse)
                .map(VisitaAtivaResponse::new)
                .orElse(new VisitaAtivaResponse(null));
    }

    @Override
    public PageResponse<VisitaResponse> historico(String usuarioId, int page, int size) {
        String uid = exigirUsuario(usuarioId);
        Page<VisitaDocument> resultado = visitaRepository.findByUsuarioIdOrderByEntradaDesc(uid, PageRequest.of(page, size));

        // E5-03/RN-22: anexa o nome do hospital (Especificacao-API-v2.0 §3.5 — "visita + hospital"),
        // resolvendo os nomes em lote (um `findAllById` para a página, não 1:N).
        Map<String, String> nomesHospitais = resolverNomesHospitais(
                resultado.getContent().stream().map(VisitaDocument::getHospitalId).toList());
        List<VisitaResponse> content = resultado.getContent().stream()
                .map(v -> toResponse(v, nomesHospitais.get(v.getHospitalId())))
                .toList();
        return PageResponse.of(content, page, size, resultado.getTotalElements());
    }

    @Override
    public void processarExpiracoes() {
        Instant agora = Instant.now();

        List<VisitaDocument> suspeitas = visitaRepository.findByStatusAndUltimoHeartbeatBefore(
                StatusVisita.EM_ATENDIMENTO, agora.minus(LIMITE_SUSPEITA));
        suspeitas.forEach(v -> v.setStatus(StatusVisita.SUSPEITA));
        visitaRepository.saveAll(suspeitas);

        List<VisitaDocument> expiradas = visitaRepository.findByStatusInAndUltimoHeartbeatBefore(
                STATUS_ATIVOS, agora.minus(LIMITE_EXPIRACAO));
        expiradas.forEach(v -> {
            v.setStatus(StatusVisita.EXPIRADA);
            v.setSaida(v.getUltimoHeartbeat());
            v.setDuracaoMinutos((int) Duration.between(v.getEntrada(), v.getUltimoHeartbeat()).toMinutes());
        });
        visitaRepository.saveAll(expiradas);
    }

    @Override
    public void processarGpsInterrompido() {
        Instant agora = Instant.now();

        List<VisitaDocument> semSinal = visitaRepository.findByStatus(StatusVisita.EM_ATENDIMENTO).stream()
                .filter(v -> Duration.between(ultimoSinalDe(v), agora).compareTo(LIMITE_GPS_INTERROMPIDO) > 0)
                .toList();

        semSinal.forEach(v -> {
            // Preserva a duração parcial calculada a partir do último sinal (heartbeat ou posição),
            // e não do instante em que o job rodou (RN-06/E2-05).
            Instant ultimoSinal = ultimoSinalDe(v);
            v.setStatus(StatusVisita.GPS_INTERROMPIDO);
            v.setSaida(ultimoSinal);
            v.setDuracaoMinutos((int) Duration.between(v.getEntrada(), ultimoSinal).toMinutes());
        });
        visitaRepository.saveAll(semSinal);
    }

    /** Último sinal de vida da visita: o mais recente entre {@code ultimoHeartbeat} e {@code ultimaPosicaoEm} (RN-06/E2-05). */
    private Instant ultimoSinalDe(VisitaDocument v) {
        Instant heartbeat = v.getUltimoHeartbeat();
        Instant posicao = v.getUltimaPosicaoEm();
        if (heartbeat == null) {
            return posicao != null ? posicao : v.getEntrada();
        }
        if (posicao == null) {
            return heartbeat;
        }
        return heartbeat.isAfter(posicao) ? heartbeat : posicao;
    }

    // ------------------------------------------------------------------
    // Resolução de geofence / conflito (E2-01, E2-04)
    // ------------------------------------------------------------------

    /**
     * Valida que o ponto informado está dentro de ao menos um geofence ativo e resolve
     * o hospital correto em caso de sobreposição, escolhendo o de centroide mais próximo
     * do ponto (E2-04/RN-05).
     */
    private String resolverHospitalPorGeofence(String hospitalIdSugerido, PosicaoDto posicao) {
        if (posicao == null) {
            throw new ValidacaoNegocioException("posicao é obrigatória para check-in via GEOFENCE.");
        }
        GeoJsonPoint ponto = new GeoJsonPoint(posicao.coordinates().getFirst(), posicao.coordinates().get(1));

        Query query = new Query(Criteria.where("ativo").is(true).and("geofence").intersects(ponto));
        List<HospitalDocument> candidatos = mongoTemplate.find(query, HospitalDocument.class);

        if (candidatos.isEmpty()) {
            throw new ValidacaoNegocioException("A posição informada não está dentro do geofence de nenhum hospital.");
        }
        if (candidatos.size() == 1) {
            return candidatos.getFirst().getId();
        }

        // Sobreposição de geofences (E2-04/RN-05): ordena por distância ao centroide.
        List<HospitalDocument> ordenados = candidatos.stream()
                .sorted(Comparator.comparingDouble(h -> distanciaMetros(ponto, h.getLocalizacao())))
                .toList();

        HospitalDocument maisProximo = ordenados.getFirst();
        HospitalDocument segundo = ordenados.get(1);
        double d1 = distanciaMetros(ponto, maisProximo.getLocalizacao());
        double d2 = distanciaMetros(ponto, segundo.getLocalizacao());

        // Empate (diferença ≤ 10m): não cria a visita; devolve candidatos para o app perguntar em 1 toque.
        if (Math.abs(d1 - d2) <= LIMITE_EMPATE_METROS) {
            List<CandidatoGeofence> candidatosResposta = ordenados.stream()
                    .map(h -> new CandidatoGeofence(h.getId(), h.getNome(),
                            distanciaMetros(ponto, h.getLocalizacao())))
                    .toList();
            throw new ConflitoGeofenceException(
                    "A posição está dentro de mais de um geofence com distâncias equivalentes. Escolha o hospital.",
                    candidatosResposta);
        }

        return maisProximo.getId();
    }

    private String exigirHospitalAtivo(String hospitalId) {
        HospitalDocument hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Hospital não encontrado para o id informado."));
        if (!hospital.isAtivo()) {
            throw new ValidacaoNegocioException("Hospital inativo não pode receber check-in.");
        }
        return hospital.getId();
    }

    /** Distância aproximada (haversine, em metros) entre dois pontos GeoJSON. */
    private double distanciaMetros(GeoJsonPoint a, GeoJsonPoint b) {
        final double raioTerraMetros = 6_371_000.0;
        double lat1 = Math.toRadians(a.getY());
        double lat2 = Math.toRadians(b.getY());
        double deltaLat = Math.toRadians(b.getY() - a.getY());
        double deltaLng = Math.toRadians(b.getX() - a.getX());

        double h = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2)
                + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
        return 2 * raioTerraMetros * Math.asin(Math.sqrt(h));
    }

    // ------------------------------------------------------------------
    // Autorização / consultas auxiliares
    // ------------------------------------------------------------------

    /** Busca a visita e garante que está ativa e pertence ao usuário autenticado (quando não anônima). */
    private VisitaDocument obterAtivaOu409(String id, String usuarioId) {
        VisitaDocument visita = visitaRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Visita não encontrada para o id informado."));

        if (visita.getUsuarioId() != null && !visita.getUsuarioId().equals(usuarioId)) {
            throw new NaoAutorizadoException("Visita não pertence ao usuário autenticado.");
        }
        if (visita.getStatus() != StatusVisita.EM_ATENDIMENTO && visita.getStatus() != StatusVisita.SUSPEITA) {
            throw new ConflitoException("Visita já encerrada (status " + visita.getStatus() + ").");
        }
        return visita;
    }

    private String exigirUsuario(String usuarioId) {
        if (usuarioId == null || usuarioId.isBlank()) {
            throw new NaoAutorizadoException("Usuário não autenticado.");
        }
        return usuarioId;
    }

    /**
     * Resolve o momento de um evento de visita.
     *
     * <p>O aplicativo informa {@code ocorridoEm} quando o evento foi detectado sem internet e
     * ficou na fila offline (OPS-05) — é o único jeito de a visita registrar a hora real da
     * entrada, e não a da reconexão. O campo vem de um endpoint público (OPS-03), então não é
     * confiável: só é aceito no passado recente, dentro da mesma janela de 24h em que uma
     * visita ainda faz sentido. Fora disso, ou ausente, vale o relógio do servidor.</p>
     *
     * <p>O limite não impede fraude — quem chama o endpoint já podia registrar uma visita
     * falsa esperando o tempo passar. Ele impede que um relógio errado no aparelho, que é o
     * caso comum, produza permanência de dias ou negativa nos indicadores (RN-15).</p>
     */
    private Instant resolverMomento(Instant ocorridoEm, Instant agora) {
        if (ocorridoEm == null) {
            return agora;
        }
        if (ocorridoEm.isAfter(agora.plus(TOLERANCIA_RELOGIO))) {
            return agora;
        }
        if (ocorridoEm.isBefore(agora.minus(LIMITE_EVENTO_OFFLINE))) {
            return agora;
        }
        // Relógio levemente adiantado, dentro da tolerância: não deixa o evento no futuro.
        return ocorridoEm.isAfter(agora) ? agora : ocorridoEm;
    }

    private PontoAmostralDocument toPontoAmostral(PosicaoDto dto, Instant em) {
        return PontoAmostralDocument.builder()
                .posicao(new GeoJsonPoint(dto.coordinates().getFirst(), dto.coordinates().get(1)))
                .em(em)
                .build();
    }

    /** Resolve em lote (um único `findAllById`) o nome de exibição dos hospitais de uma página. */
    private Map<String, String> resolverNomesHospitais(List<String> ids) {
        List<String> distintos = ids.stream().filter(Objects::nonNull).distinct().toList();
        if (distintos.isEmpty()) {
            return Map.of();
        }
        return hospitalRepository.findAllById(distintos).stream()
                .collect(Collectors.toMap(HospitalDocument::getId, HospitalDocument::getNome, (a, b) -> a));
    }

    private VisitaResponse toResponse(VisitaDocument v) {
        return toResponse(v, null);
    }

    private VisitaResponse toResponse(VisitaDocument v, String hospitalNome) {
        // RN-07/E2-08: visita "curta" (< 2min) permanece no histórico, mas não é estatisticamente válida.
        boolean visitaValida = v.getDuracaoMinutos() == null || v.getDuracaoMinutos() >= 2;
        return new VisitaResponse(
                v.getId(), v.getUsuarioId(), v.getHospitalId(), hospitalNome, v.getEntrada(), v.getSaida(),
                v.getDuracaoMinutos(), v.getStatus(), v.getTipoPermanencia(), v.getUltimoHeartbeat(),
                v.getOrigem(), v.getCriadoEm(), visitaValida);
    }
}
