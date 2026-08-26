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
import java.util.List;

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
                ? visitaRepository.findFirstByUsuarioIdAndHospitalIdAndStatusInOrderByEntradaDesc(
                        usuarioId, hospitalId, STATUS_ATIVOS).orElse(null)
                : visitaRepository.findFirstByDispositivoIdAndHospitalIdAndStatusInOrderByEntradaDesc(
                        request.dispositivoId(), hospitalId, STATUS_ATIVOS).orElse(null);

        // Idempotência (RN-03/§3.3): já existe visita ativa no mesmo hospital, retorna a existente.
        if (existente != null) {
            return new CheckinResponse(existente.getId(), existente.getHospitalId(),
                    existente.getEntrada(), existente.getStatus());
        }

        Instant agora = Instant.now();
        VisitaDocument.VisitaDocumentBuilder builder = VisitaDocument.builder()
                .usuarioId(usuarioId)
                .dispositivoId(request.dispositivoId())
                .hospitalId(hospitalId)
                .entrada(agora)
                .status(StatusVisita.EM_ATENDIMENTO)
                .tipoPermanencia(TipoPermanencia.ATENDIMENTO)
                .ultimoHeartbeat(agora)
                .origem(request.origem())
                .criadoEm(agora);

        if (request.posicao() != null) {
            builder.pontosAmostrais(List.of(toPontoAmostral(request.posicao(), agora)));
        }

        VisitaDocument salva = visitaRepository.save(builder.build());
        return new CheckinResponse(salva.getId(), salva.getHospitalId(), salva.getEntrada(), salva.getStatus());
    }

    @Override
    public CheckoutResponse checkout(String id, CheckoutRequest request, String usuarioId) {
        VisitaDocument visita = obterAtivaOu409(id, usuarioId);

        Instant agora = Instant.now();
        boolean gpsIndisponivel = Boolean.TRUE.equals(request.gpsIndisponivel());

        visita.setSaida(agora);
        visita.setDuracaoMinutos((int) Duration.between(visita.getEntrada(), agora).toMinutes());
        visita.setStatus(gpsIndisponivel ? StatusVisita.GPS_INTERROMPIDO : StatusVisita.FINALIZADA);
        if (request.posicao() != null) {
            visita.getPontosAmostrais().add(toPontoAmostral(request.posicao(), agora));
        }

        VisitaDocument salva = visitaRepository.save(visita);
        return new CheckoutResponse(salva.getId(), salva.getSaida(), salva.getDuracaoMinutos(), salva.getStatus());
    }

    @Override
    public HeartbeatResponse heartbeat(String id, String usuarioId) {
        VisitaDocument visita = obterAtivaOu409(id, usuarioId);

        Instant agora = Instant.now();
        visita.setUltimoHeartbeat(agora);
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
    public VisitaAtivaResponse buscarAtiva(String usuarioId) {
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
        List<VisitaResponse> content = resultado.getContent().stream().map(this::toResponse).toList();
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
        GeoJsonPoint ponto = new GeoJsonPoint(posicao.coordinates().get(0), posicao.coordinates().get(1));

        Query query = new Query(Criteria.where("ativo").is(true).and("geofence").intersects(ponto));
        List<HospitalDocument> candidatos = mongoTemplate.find(query, HospitalDocument.class);

        if (candidatos.isEmpty()) {
            throw new ValidacaoNegocioException("A posição informada não está dentro do geofence de nenhum hospital.");
        }
        if (candidatos.size() == 1) {
            return candidatos.get(0).getId();
        }

        // Sobreposição de geofences: escolhe o hospital de centroide mais próximo do ponto.
        return candidatos.stream()
                .min((a, b) -> Double.compare(
                        distanciaMetros(ponto, a.getLocalizacao()),
                        distanciaMetros(ponto, b.getLocalizacao())))
                .map(HospitalDocument::getId)
                .orElse(hospitalIdSugerido);
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

    private PontoAmostralDocument toPontoAmostral(PosicaoDto dto, Instant em) {
        return PontoAmostralDocument.builder()
                .posicao(new GeoJsonPoint(dto.coordinates().get(0), dto.coordinates().get(1)))
                .em(em)
                .build();
    }

    private VisitaResponse toResponse(VisitaDocument v) {
        return new VisitaResponse(
                v.getId(), v.getUsuarioId(), v.getHospitalId(), v.getEntrada(), v.getSaida(),
                v.getDuracaoMinutos(), v.getStatus(), v.getTipoPermanencia(), v.getUltimoHeartbeat(),
                v.getOrigem(), v.getCriadoEm());
    }
}
