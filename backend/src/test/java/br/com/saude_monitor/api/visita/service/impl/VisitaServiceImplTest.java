package br.com.saude_monitor.api.visita.service.impl;

import br.com.saude_monitor.api.config.exception.AcessoNegadoException;
import br.com.saude_monitor.api.config.exception.NaoAutorizadoException;
import br.com.saude_monitor.api.config.exception.ConflitoException;
import br.com.saude_monitor.api.config.exception.ValidacaoNegocioException;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.visita.document.OrigemVisita;
import br.com.saude_monitor.api.visita.document.PontoAmostralDocument;
import br.com.saude_monitor.api.visita.document.StatusVisita;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import br.com.saude_monitor.api.hospital.dto.PageResponse;
import br.com.saude_monitor.api.visita.dto.CheckinRequest;
import br.com.saude_monitor.api.visita.dto.CheckinResponse;
import br.com.saude_monitor.api.visita.dto.CheckoutRequest;
import br.com.saude_monitor.api.visita.dto.CheckoutResponse;
import br.com.saude_monitor.api.visita.dto.HeartbeatResponse;
import br.com.saude_monitor.api.visita.dto.PosicaoDto;
import br.com.saude_monitor.api.visita.dto.TipoPermanenciaRequest;
import br.com.saude_monitor.api.visita.document.TipoPermanencia;
import br.com.saude_monitor.api.visita.dto.VisitaAtivaResponse;
import br.com.saude_monitor.api.visita.dto.VisitaResponse;
import br.com.saude_monitor.api.visita.repository.VisitaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.bson.Document;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Fluxo anônimo de visitas (modo sem login, §3.3): check-in por dispositivoId e
 * recuperação da visita ativa do dispositivo em {@code GET /ativas}.
 */
class VisitaServiceImplTest {

    private VisitaServiceImpl visitaService;
    private VisitaRepository visitaRepository;
    private HospitalRepository hospitalRepository;
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void setup() {
        visitaRepository = mock(VisitaRepository.class);
        hospitalRepository = mock(HospitalRepository.class);
        mongoTemplate = mock(MongoTemplate.class);
        visitaService = new VisitaServiceImpl(visitaRepository, hospitalRepository, mongoTemplate);
        // Update atômico (ARQ-04): aplica o `Update` ao documento que o `findById` do teste
        // devolve, como o Mongo faria, e devolve o documento atualizado (returnNew).
        when(mongoTemplate.findAndModify(any(Query.class), any(Update.class),
                any(FindAndModifyOptions.class), eq(VisitaDocument.class))).thenAnswer(inv -> {
            Query query = inv.getArgument(0);
            String id = String.valueOf(query.getQueryObject().get("_id"));
            return visitaRepository.findById(id)
                    .filter(v -> hasDonoCorrespondente(v, query.getQueryObject()))
                    .map(v -> aplicar(v, inv.getArgument(1)))
                    .orElse(null);
        });
    }

    /**
     * Avalia o filtro de dono do heartbeat ({@code $and} com um {@code $or} de igualdades)
     * sobre o documento em memória. Sem {@code $and}, não há filtro de dono.
     */
    @SuppressWarnings("unchecked")
    private static boolean hasDonoCorrespondente(VisitaDocument v, Document filtro) {
        if (!filtro.containsKey("$and")) {
            return true;
        }
        Document dono = ((List<Document>) filtro.get("$and")).getFirst();
        if (!dono.containsKey("$or")) {
            return false; // filtro "ninguém é dono"
        }
        return ((List<Document>) dono.get("$or")).stream().anyMatch(clausula -> clausula.entrySet().stream()
                .allMatch(e -> java.util.Objects.equals(e.getValue(), switch (e.getKey()) {
                    case "usuarioId" -> v.getUsuarioId();
                    case "dispositivoId" -> v.getDispositivoId();
                    default -> throw new IllegalArgumentException("campo não previsto: " + e.getKey());
                })));
    }

    /** Aplica `$set`, `$unset` e `$push` de um {@link Update} a um documento em memória. */
    static VisitaDocument aplicar(VisitaDocument v, Update update) {
        Document set = (Document) update.getUpdateObject().getOrDefault("$set", new Document());
        set.forEach((campo, valor) -> {
            switch (campo) {
                case "saida" -> v.setSaida((Instant) valor);
                case "duracaoMinutos" -> v.setDuracaoMinutos((Integer) valor);
                case "status" -> v.setStatus((StatusVisita) valor);
                case "processadoEm" -> v.setProcessadoEm((Instant) valor);
                case "encerramentoManual" -> v.setEncerramentoManual((Boolean) valor);
                case "ultimoHeartbeat" -> v.setUltimoHeartbeat((Instant) valor);
                case "ultimaPosicaoEm" -> v.setUltimaPosicaoEm((Instant) valor);
                case "usuarioId" -> v.setUsuarioId((String) valor);
                case "tipoPermanencia" -> v.setTipoPermanencia((TipoPermanencia) valor);
                case "encerradaSemSinal" -> v.setEncerradaSemSinal((Boolean) valor);
                default -> throw new IllegalArgumentException("campo não previsto no teste: " + campo);
            }
        });
        Document unset = (Document) update.getUpdateObject().getOrDefault("$unset", new Document());
        if (unset.containsKey("pontosAmostrais")) {
            v.setPontosAmostrais(null);
        }
        if (unset.containsKey("dispositivoId")) {
            v.setDispositivoId(null);
        }
        if (unset.containsKey("encerradaSemSinal")) {
            v.setEncerradaSemSinal(null);
        }
        Document push = (Document) update.getUpdateObject().getOrDefault("$push", new Document());
        if (push.containsKey("pontosAmostrais")) {
            java.util.Map<String, Object> modificador = new java.util.HashMap<>();
            ((Update.Modifiers) push.get("pontosAmostrais")).getModifiers()
                    .forEach(m -> modificador.put(m.getKey(), m.getValue()));
            List<PontoAmostralDocument> novos = new java.util.ArrayList<>(
                    v.getPontosAmostrais() == null ? List.of() : v.getPontosAmostrais());
            for (Object ponto : (Object[]) modificador.get("$each")) {
                novos.add((PontoAmostralDocument) ponto);
            }
            int slice = Math.abs(((Number) modificador.get("$slice")).intValue());
            v.setPontosAmostrais(novos.subList(Math.max(0, novos.size() - slice), novos.size()));
        }
        return v;
    }

    private HospitalDocument hospitalAtivo(String id) {
        return HospitalDocument.builder().id(id).ativo(true).build();
    }

    private VisitaDocument visitaAtivaAnonima(String dispositivoId) {
        return VisitaDocument.builder()
                .id("v9")
                .dispositivoId(dispositivoId)
                .hospitalId("h1")
                .entrada(Instant.now())
                .status(StatusVisita.EM_ATENDIMENTO)
                .build();
    }

    @Test
    void checkinAnonimoSemDispositivoIdLancaErro() {
        CheckinRequest request = new CheckinRequest("h1", OrigemVisita.MANUAL, null, null, null);

        assertThrows(ValidacaoNegocioException.class, () -> visitaService.checkin(request, null));
        verify(visitaRepository, never()).save(any(VisitaDocument.class));
    }

    @Test
    void checkinAnonimoComDispositivoIdCriaVisita() {
        when(hospitalRepository.findById("h1")).thenReturn(Optional.of(hospitalAtivo("h1")));
        when(visitaRepository.findFirstByDispositivoIdAndStatusInOrderByEntradaDesc(
            anyString(), any())).thenReturn(Optional.empty());
        when(visitaRepository.save(any(VisitaDocument.class))).thenAnswer(inv -> {
            VisitaDocument v = inv.getArgument(0);
            v.setId("v9");
            return v;
        });

        CheckinRequest request = new CheckinRequest("h1", OrigemVisita.MANUAL, null, "anon-abc", null);
        CheckinResponse resposta = visitaService.checkin(request, null);

        assertTrue(resposta.criado());
        assertEquals("v9", resposta.id());
        verify(visitaRepository).save(any(VisitaDocument.class));
    }

    @Test
    void checkinAnonimoEmOutroHospitalComVisitaAtivaLancaConflito() {
        when(hospitalRepository.findById("h2")).thenReturn(Optional.of(hospitalAtivo("h2")));
        when(visitaRepository.findFirstByDispositivoIdAndStatusInOrderByEntradaDesc(
                "anon-abc", List.of(StatusVisita.EM_ATENDIMENTO, StatusVisita.SUSPEITA)))
                .thenReturn(Optional.of(visitaAtivaAnonima("anon-abc")));

        CheckinRequest request = new CheckinRequest("h2", OrigemVisita.MANUAL, null, "anon-abc", null);

        assertThrows(ConflitoException.class, () -> visitaService.checkin(request, null));
        verify(visitaRepository, never()).save(any(VisitaDocument.class));
    }

    /**
     * Fila offline do aplicativo (OPS-05): o evento pode chegar minutos ou horas depois de
     * ter acontecido, e é o {@code ocorridoEm} que impede a visita de registrar a hora da
     * reconexão em vez da hora da entrada.
     */
    private void aoSalvarDevolverComId() {
        when(visitaRepository.save(any(VisitaDocument.class))).thenAnswer(inv -> {
            VisitaDocument v = inv.getArgument(0);
            v.setId("v9");
            return v;
        });
    }

    @Test
    void checkinComOcorridoEmRegistraAHoraRealDaEntrada() {
        when(hospitalRepository.findById("h1")).thenReturn(Optional.of(hospitalAtivo("h1")));
        when(visitaRepository.findFirstByDispositivoIdAndStatusInOrderByEntradaDesc(
                anyString(), any())).thenReturn(Optional.empty());
        aoSalvarDevolverComId();

        Instant entradaReal = Instant.now().minus(Duration.ofHours(2));
        CheckinRequest request =
                new CheckinRequest("h1", OrigemVisita.MANUAL, null, "anon-abc", entradaReal);

        CheckinResponse resposta = visitaService.checkin(request, null);

        assertEquals(entradaReal, resposta.entrada());
    }

    @Test
    void checkinIgnoraOcorridoEmNoFuturo() {
        when(hospitalRepository.findById("h1")).thenReturn(Optional.of(hospitalAtivo("h1")));
        when(visitaRepository.findFirstByDispositivoIdAndStatusInOrderByEntradaDesc(
                anyString(), any())).thenReturn(Optional.empty());
        aoSalvarDevolverComId();

        Instant futuro = Instant.now().plus(Duration.ofDays(1));
        CheckinRequest request =
                new CheckinRequest("h1", OrigemVisita.MANUAL, null, "anon-abc", futuro);

        CheckinResponse resposta = visitaService.checkin(request, null);

        assertTrue(resposta.entrada().isBefore(futuro));
    }

    @Test
    void checkinIgnoraOcorridoEmAlemDaJanelaDe24h() {
        when(hospitalRepository.findById("h1")).thenReturn(Optional.of(hospitalAtivo("h1")));
        when(visitaRepository.findFirstByDispositivoIdAndStatusInOrderByEntradaDesc(
                anyString(), any())).thenReturn(Optional.empty());
        aoSalvarDevolverComId();

        Instant antigo = Instant.now().minus(Duration.ofDays(3));
        CheckinRequest request =
                new CheckinRequest("h1", OrigemVisita.MANUAL, null, "anon-abc", antigo);

        CheckinResponse resposta = visitaService.checkin(request, null);

        assertTrue(resposta.entrada().isAfter(antigo));
    }

    @Test
    void checkoutComOcorridoEmCalculaDuracaoPelaHoraRealDaSaida() {
        Instant entrada = Instant.now().minus(Duration.ofHours(3));
        VisitaDocument visita = VisitaDocument.builder()
                .id("v9")
                .usuarioId("u1")
                .hospitalId("h1")
                .entrada(entrada)
                .status(StatusVisita.EM_ATENDIMENTO)
                .pontosAmostrais(new java.util.ArrayList<>())
                .build();
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visita));

        Instant saidaReal = entrada.plus(Duration.ofMinutes(45));
        CheckoutResponse resposta =
                visitaService.checkout("v9", new CheckoutRequest(null, null, null, saidaReal, null), "u1");

        assertEquals(saidaReal, resposta.saida());
        assertEquals(45, resposta.duracaoMinutos());
    }

    @Test
    void checkoutDeVisitaDeOutroUsuarioLancaAcessoNegado() {
        // Achado F-02 do pentest de 23/09/2026: o chamador está autenticado (tem um token
        // válido) — só não é dono desta visita. 403 (ACESSO_NEGADO), não 401.
        VisitaDocument visitaDeOutro = VisitaDocument.builder()
                .id("v9")
                .usuarioId("dono-legitimo")
                .hospitalId("h1")
                .entrada(Instant.now())
                .status(StatusVisita.EM_ATENDIMENTO)
                .build();
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visitaDeOutro));

        CheckoutRequest semAparelho = new CheckoutRequest(null, null, null, null, null);
        assertThrows(AcessoNegadoException.class, () -> visitaService.checkout("v9", semAparelho, "invasor"));
        verify(mongoTemplate, never()).findAndModify(any(Query.class), any(Update.class),
                any(FindAndModifyOptions.class), eq(VisitaDocument.class));
    }

    @Test
    void checkoutNaoAceitaSaidaAnteriorAEntrada() {
        Instant entrada = Instant.now().minus(Duration.ofHours(1));
        VisitaDocument visita = VisitaDocument.builder()
                .id("v9")
                .usuarioId("u1")
                .hospitalId("h1")
                .entrada(entrada)
                .status(StatusVisita.EM_ATENDIMENTO)
                .pontosAmostrais(new java.util.ArrayList<>())
                .build();
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visita));

        // Relógio do aparelho atrasado: sem a proteção, a duração ficaria negativa e
        // envenenaria a mediana de permanência (RN-15).
        Instant saidaImpossivel = entrada.minus(Duration.ofMinutes(30));
        CheckoutResponse resposta =
                visitaService.checkout("v9", new CheckoutRequest(null, null, null, saidaImpossivel, null), "u1");

        assertEquals(entrada, resposta.saida());
        assertEquals(0, resposta.duracaoMinutos());
    }

    // ------------------------------------------------ dono da visita anônima (SEG-02) --------------------------

    @Test
    void heartbeatDeVisitaAnonimaSemODispositivoDonoLancaAcessoNegado() {
        VisitaDocument visita = visitaAtivaAnonima("anon-dono");
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visita));

        assertThrows(AcessoNegadoException.class, () -> visitaService.heartbeat("v9", null, null, null));
        assertThrows(AcessoNegadoException.class,
                () -> visitaService.heartbeat("v9", null, "anon-intruso", null));
        // Estar logado não dá posse de visita anônima alheia.
        assertThrows(AcessoNegadoException.class,
                () -> visitaService.heartbeat("v9", "u-qualquer", null, null));
        // O filtro de dono vai no próprio update: nada foi gravado na visita.
        assertNull(visita.getUltimoHeartbeat());
    }

    @Test
    void heartbeatDeVisitaAnonimaComODispositivoDonoRenovaSinal() {
        VisitaDocument visita = visitaAtivaAnonima("anon-dono");
        visita.setStatus(StatusVisita.SUSPEITA);
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visita));

        // Usuário que fez login no meio de uma visita anônima continua dono pelo aparelho.
        HeartbeatResponse resposta = visitaService.heartbeat("v9", "u-logou-depois", "anon-dono", null);

        assertEquals(StatusVisita.EM_ATENDIMENTO, resposta.status());
        assertNotNull(resposta.ultimoHeartbeat());
    }

    @Test
    void checkoutDeVisitaAnonimaExigeODispositivoDono() {
        VisitaDocument visita = visitaAtivaAnonima("anon-dono");
        visita.setPontosAmostrais(new java.util.ArrayList<>());
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visita));

        CheckoutRequest doIntruso = new CheckoutRequest(null, null, null, null, "anon-x");
        assertThrows(AcessoNegadoException.class, () -> visitaService.checkout("v9", doIntruso, null));

        CheckoutResponse resposta =
                visitaService.checkout("v9", new CheckoutRequest(null, null, null, null, "anon-dono"), null);
        assertEquals(StatusVisita.FINALIZADA, resposta.status());
    }

    @Test
    void sinalizarTipoPermanenciaDoDonoLogadoApos12h() {
        VisitaDocument visita = VisitaDocument.builder()
                .id("v9").usuarioId("u1").hospitalId("h1")
                .entrada(Instant.now().minus(Duration.ofHours(13)))
                .status(StatusVisita.EM_ATENDIMENTO)
                .build();
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visita));

        assertEquals(TipoPermanencia.INTERNACAO, visitaService.sinalizarTipoPermanencia(
                "v9", new TipoPermanenciaRequest(TipoPermanencia.INTERNACAO, null), "u1").tipoPermanencia());
    }

    @Test
    void sinalizarTipoPermanenciaEmVisitaAnonimaAlheiaLancaAcessoNegado() {
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visitaAtivaAnonima("anon-dono")));

        TipoPermanenciaRequest semAparelho = new TipoPermanenciaRequest(TipoPermanencia.INTERNACAO, null);
        TipoPermanenciaRequest doIntruso = new TipoPermanenciaRequest(TipoPermanencia.INTERNACAO, "anon-x");
        assertThrows(AcessoNegadoException.class,
                () -> visitaService.sinalizarTipoPermanencia("v9", semAparelho, "u-qualquer"));
        assertThrows(AcessoNegadoException.class,
                () -> visitaService.sinalizarTipoPermanencia("v9", doIntruso, "u-qualquer"));
    }

    @Test
    void sinalizarTipoPermanenciaDeVisitaAnonimaPeloAparelhoDonoAposLogin() {
        VisitaDocument visita = visitaAtivaAnonima("anon-dono");
        visita.setEntrada(Instant.now().minus(Duration.ofHours(13)));
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visita));

        assertEquals(TipoPermanencia.OBSERVACAO, visitaService.sinalizarTipoPermanencia(
                "v9", new TipoPermanenciaRequest(TipoPermanencia.OBSERVACAO, "anon-dono"), "u1").tipoPermanencia());
    }

    @Test
    void buscarAtivaAnonimaPorDispositivoRetornaVisita() {
        when(visitaRepository.findFirstByDispositivoIdAndStatusInOrderByEntradaDesc(
                "anon-abc", List.of(StatusVisita.EM_ATENDIMENTO, StatusVisita.SUSPEITA)))
                .thenReturn(Optional.of(visitaAtivaAnonima("anon-abc")));

        VisitaAtivaResponse resposta = visitaService.buscarAtiva(null, "anon-abc");

        assertEquals("h1", resposta.visita().hospitalId());
    }

    @Test
    void buscarAtivaAnonimaSemVisitaRetornaNulo() {
        when(visitaRepository.findFirstByDispositivoIdAndStatusInOrderByEntradaDesc(
                anyString(), any())).thenReturn(Optional.empty());

        VisitaAtivaResponse resposta = visitaService.buscarAtiva(null, "anon-abc");

        assertNull(resposta.visita());
    }

    @Test
    void buscarAtivaSemAutenticacaoNemDispositivoLancaErro() {
        assertThrows(NaoAutorizadoException.class, () -> visitaService.buscarAtiva(null, null));
        verify(visitaRepository, never()).findFirstByDispositivoIdAndStatusInOrderByEntradaDesc(
                anyString(), any());
    }

    @Test
    void historicoAnexaNomeDoHospital() {
        VisitaDocument visita = VisitaDocument.builder()
                .id("v10")
                .usuarioId("u1")
                .hospitalId("h1")
                .entrada(Instant.parse("2026-08-30T10:00:00Z"))
                .saida(Instant.parse("2026-08-30T11:30:00Z"))
                .duracaoMinutos(90)
                .status(StatusVisita.FINALIZADA)
                .origem(OrigemVisita.GEOFENCE)
                .build();

        when(visitaRepository.findByUsuarioIdOrderByEntradaDesc("u1", PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(visita)));
        when(hospitalRepository.findAllById(List.of("h1")))
                .thenReturn(List.of(HospitalDocument.builder().id("h1").nome("Hospital Central").build()));

        PageResponse<VisitaResponse> resultado = visitaService.historico("u1", 0, 20);

        assertEquals(1, resultado.content().size());
        VisitaResponse item = resultado.content().get(0);
        assertEquals("h1", item.hospitalId());
        assertEquals("Hospital Central", item.hospitalNome());
    }

    // ------------------------------------------------ retenção do GPS e update atômico (DAD-01/ARQ-04) ---------

    private static final PosicaoDto POSICAO = new PosicaoDto("Point", List.of(-47.88, -15.79));

    private VisitaDocument criarVisitaLogadaAtiva() {
        return VisitaDocument.builder()
                .id("v9").usuarioId("u1").hospitalId("h1")
                .entrada(Instant.now().minus(Duration.ofHours(1)))
                .status(StatusVisita.SUSPEITA)
                .pontosAmostrais(new java.util.ArrayList<>())
                .build();
    }

    @Test
    void heartbeatComPosicaoGuardaSoOsPontosMaisRecentes() {
        VisitaDocument visita = criarVisitaLogadaAtiva();
        for (int i = 0; i < VisitaServiceImpl.LIMITE_PONTOS_AMOSTRAIS; i++) {
            visita.getPontosAmostrais().add(PontoAmostralDocument.builder().em(Instant.EPOCH.plusSeconds(i)).build());
        }
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visita));

        HeartbeatResponse resposta = visitaService.heartbeat("v9", "u1", null, POSICAO);

        assertEquals(StatusVisita.EM_ATENDIMENTO, resposta.status());
        assertEquals(VisitaServiceImpl.LIMITE_PONTOS_AMOSTRAIS, visita.getPontosAmostrais().size());
        assertEquals(resposta.ultimoHeartbeat(), visita.getPontosAmostrais().getLast().getEm());
        assertEquals(Instant.EPOCH.plusSeconds(1), visita.getPontosAmostrais().getFirst().getEm());
        verify(visitaRepository, never()).save(any(VisitaDocument.class));
    }

    @Test
    void heartbeatDeVisitaEncerradaNoMeioDoCaminhoLancaConflito() {
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(criarVisitaLogadaAtiva()));
        // O job encerrou a visita entre a leitura e a escrita: o update condicionado não acha nada.
        when(mongoTemplate.findAndModify(any(Query.class), any(Update.class),
                any(FindAndModifyOptions.class), eq(VisitaDocument.class))).thenReturn(null);

        assertThrows(ConflitoException.class, () -> visitaService.heartbeat("v9", "u1", null, null));
    }

    @Test
    void checkoutDeVisitaEncerradaPeloJobNoMeioDoCaminhoLancaConflito() {
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(criarVisitaLogadaAtiva()));
        when(mongoTemplate.findAndModify(any(Query.class), any(Update.class),
                any(FindAndModifyOptions.class), eq(VisitaDocument.class))).thenReturn(null);

        CheckoutRequest pedido = new CheckoutRequest(null, null, null, null, null);
        assertThrows(ConflitoException.class, () -> visitaService.checkout("v9", pedido, "u1"));
    }

    @Test
    void checkoutApagaOsPontosDeGpsEGuardaSoEntradaSaidaEDuracao() {
        VisitaDocument visita = criarVisitaLogadaAtiva();
        visita.getPontosAmostrais().add(PontoAmostralDocument.builder().em(Instant.now()).build());
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visita));

        CheckoutResponse resposta = visitaService.checkout(
                "v9", new CheckoutRequest(POSICAO, null, true, null, null), "u1");

        assertEquals(StatusVisita.FINALIZADA, resposta.status());
        assertTrue(resposta.encerramentoManual());
        assertNull(visita.getPontosAmostrais());
        assertNotNull(visita.getUltimaPosicaoEm());
        assertNotNull(visita.getProcessadoEm());
    }

    @Test
    void processarExpiracoesMarcaSuspeitaEmLoteEExpiraApagandoPontos() {
        Instant agora = Instant.now();
        VisitaDocument antiga = VisitaDocument.builder()
                .id("v1").hospitalId("h1").status(StatusVisita.SUSPEITA)
                .entrada(agora.minus(Duration.ofHours(30)))
                .ultimoHeartbeat(agora.minus(Duration.ofHours(25)))
                .pontosAmostrais(new java.util.ArrayList<>(List.of(PontoAmostralDocument.builder().build())))
                .build();
        when(visitaRepository.findByStatusInAndUltimoHeartbeatBefore(any(), any())).thenReturn(List.of(antiga));

        visitaService.processarExpiracoes();

        ArgumentCaptor<Query> suspeita = ArgumentCaptor.forClass(Query.class);
        ArgumentCaptor<Update> marcaSuspeita = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).updateMulti(suspeita.capture(), marcaSuspeita.capture(), eq(VisitaDocument.class));
        assertEquals(StatusVisita.EM_ATENDIMENTO, suspeita.getValue().getQueryObject().get("status"));
        assertEquals(StatusVisita.SUSPEITA,
                ((Document) marcaSuspeita.getValue().getUpdateObject().get("$set")).get("status"));

        ArgumentCaptor<Update> expira = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).updateFirst(any(Query.class), expira.capture(), eq(VisitaDocument.class));
        aplicar(antiga, expira.getValue());
        assertEquals(StatusVisita.EXPIRADA, antiga.getStatus());
        assertEquals(300, antiga.getDuracaoMinutos());
        assertNull(antiga.getPontosAmostrais());
    }

    @Test
    void apagarPontosDeVisitasEncerradasPegaSoAsQueNaoEstaoAtivas() {
        com.mongodb.client.result.UpdateResult resultado = mock(com.mongodb.client.result.UpdateResult.class);
        when(resultado.getModifiedCount()).thenReturn(4L);
        when(mongoTemplate.updateMulti(any(Query.class), any(Update.class), eq(VisitaDocument.class)))
                .thenReturn(resultado);

        assertEquals(4L, visitaService.apagarPontosDeVisitasEncerradas());

        ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
        ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).updateMulti(query.capture(), update.capture(), eq(VisitaDocument.class));
        assertEquals(List.of(StatusVisita.EM_ATENDIMENTO, StatusVisita.SUSPEITA),
                ((Document) query.getValue().getQueryObject().get("status")).get("$nin"));
        assertTrue(((Document) update.getValue().getUpdateObject().get("$unset")).containsKey("pontosAmostrais"));
    }

    @Test
    void heartbeatSemUsuarioNemAparelhoNaoAtualizaNada() {
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visitaAtivaAnonima("anon-dono")));

        assertThrows(AcessoNegadoException.class, () -> visitaService.heartbeat("v9", null, " ", null));
    }

    @Test
    void desvincularVisitasAntigasTiraContaAparelhoEPontosDepoisDe90Dias() {
        com.mongodb.client.result.UpdateResult resultado = mock(com.mongodb.client.result.UpdateResult.class);
        when(resultado.getModifiedCount()).thenReturn(3L);
        when(mongoTemplate.updateMulti(any(Query.class), any(Update.class), eq(VisitaDocument.class)))
                .thenReturn(resultado);
        Instant antes = Instant.now();

        assertEquals(3L, visitaService.desvincularVisitasAntigas());

        ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
        ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).updateMulti(query.capture(), update.capture(), eq(VisitaDocument.class));
        Instant corte = (Instant) ((Document) query.getValue().getQueryObject().get("entrada")).get("$lt");
        Instant esperado = antes.minus(Duration.ofDays(90));
        assertFalse(corte.isBefore(esperado.minusSeconds(5)));
        assertFalse(corte.isAfter(esperado.plusSeconds(5)));

        VisitaDocument visita = VisitaDocument.builder().usuarioId("u1").dispositivoId("anon-a")
                .pontosAmostrais(new java.util.ArrayList<>()).build();
        aplicar(visita, update.getValue());
        assertNull(visita.getUsuarioId());
        assertNull(visita.getDispositivoId());
        assertNull(visita.getPontosAmostrais());
    }

    // ------------------------------------------------ processarGpsInterrompido (09/09/2026) --------------------

    private VisitaDocument visitaComSinal(Instant ultimoHeartbeat, Instant ultimaPosicaoEm) {
        return VisitaDocument.builder()
                .id("v1")
                .hospitalId("h1")
                .entrada(Instant.now().minus(java.time.Duration.ofHours(1)))
                .status(StatusVisita.EM_ATENDIMENTO)
                .ultimoHeartbeat(ultimoHeartbeat)
                .ultimaPosicaoEm(ultimaPosicaoEm)
                .build();
    }

    /**
     * Antes trazia TODA visita EM_ATENDIMENTO (`findByStatus`) e filtrava em Java.
     * Agora pré-filtra no Mongo por `ultimoHeartbeat`, mas a decisão final continua em
     * `ultimoSinalDe` (o mais recente entre heartbeat e posição) — este teste prova que
     * uma posição recente ainda protege a visita mesmo com heartbeat antigo.
     */
    @Test
    void processarGpsInterrompidoNaoMarcaQuandoPosicaoRecenteMesmoComHeartbeatAntigo() {
        Instant agora = Instant.now();
        VisitaDocument comPosicaoRecente = visitaComSinal(agora.minus(Duration.ofMinutes(50)), agora.minus(Duration.ofMinutes(1)));
        when(visitaRepository.findByStatusAndUltimoHeartbeatBefore(any(), any()))
                .thenReturn(List.of(comPosicaoRecente));

        visitaService.processarGpsInterrompido();

        verify(mongoTemplate, never()).updateFirst(any(Query.class), any(Update.class), eq(VisitaDocument.class));
    }

    @Test
    void processarGpsInterrompidoMarcaQuandoHeartbeatAntigoSemPosicao() {
        Instant agora = Instant.now();
        VisitaDocument semPosicao = visitaComSinal(agora.minus(Duration.ofMinutes(50)), null);
        when(visitaRepository.findByStatusAndUltimoHeartbeatBefore(any(), any()))
                .thenReturn(List.of(semPosicao));

        visitaService.processarGpsInterrompido();

        ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
        ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).updateFirst(query.capture(), update.capture(), eq(VisitaDocument.class));
        aplicar(semPosicao, update.getValue());
        assertEquals(StatusVisita.GPS_INTERROMPIDO, semPosicao.getStatus());
        assertEquals(semPosicao.getUltimoHeartbeat(), semPosicao.getSaida());
        // A saída é a do último sinal: o checkout atrasado do aparelho ainda pode corrigi-la.
        assertEquals(Boolean.TRUE, semPosicao.getEncerradaSemSinal());
        // Só encerra se nenhum heartbeat chegou depois da leitura (ARQ-04).
        assertEquals(semPosicao.getUltimoHeartbeat(), query.getValue().getQueryObject().get("ultimoHeartbeat"));
    }

    @Test
    void processarGpsInterrompidoConsultaPorHeartbeatNoMongoNaoTrazTudo() {
        when(visitaRepository.findByStatusAndUltimoHeartbeatBefore(any(), any())).thenReturn(List.of());

        visitaService.processarGpsInterrompido();

        verify(visitaRepository).findByStatusAndUltimoHeartbeatBefore(org.mockito.ArgumentMatchers.eq(StatusVisita.EM_ATENDIMENTO), any());
    }

    /**
     * Decisão do PO de 05/10/2026 (Auditoria Técnica v4.0): o app manda heartbeat a cada
     * 30 min (RN-23). Com a janela antiga de 10 min, uma visita com o app aberto e sem
     * nenhum problema de GPS era encerrada entre dois heartbeats.
     */
    @Test
    void processarGpsInterrompidoNaoEncerraVisitaEntreDoisHeartbeats() {
        Instant agora = Instant.now();
        VisitaDocument entreHeartbeats = visitaComSinal(agora.minus(Duration.ofMinutes(31)), null);
        when(visitaRepository.findByStatusAndUltimoHeartbeatBefore(any(), any()))
                .thenReturn(List.of(entreHeartbeats));

        visitaService.processarGpsInterrompido();

        verify(mongoTemplate, never()).updateFirst(any(Query.class), any(Update.class), eq(VisitaDocument.class));
    }

    @Test
    void processarGpsInterrompidoUsaCorteDe45MinutosNoMongo() {
        when(visitaRepository.findByStatusAndUltimoHeartbeatBefore(any(), any())).thenReturn(List.of());
        Instant antes = Instant.now();

        visitaService.processarGpsInterrompido();

        ArgumentCaptor<Instant> corte = ArgumentCaptor.forClass(Instant.class);
        verify(visitaRepository).findByStatusAndUltimoHeartbeatBefore(any(), corte.capture());
        Instant esperado = antes.minus(Duration.ofMinutes(45));
        assertFalse(corte.getValue().isBefore(esperado.minusSeconds(5)));
        assertFalse(corte.getValue().isAfter(esperado.plusSeconds(5)));
    }

    // ------------------------------------------------------------------
    // Checkout atrasado de visita encerrada pelo job de GPS interrompido
    // (teste de campo de 23/10/2026)
    // ------------------------------------------------------------------

    private VisitaDocument visitaEncerradaPeloJob(Instant entrada) {
        return VisitaDocument.builder()
                .id("v9")
                .usuarioId("u1")
                .hospitalId("h1")
                .entrada(entrada)
                .saida(entrada)
                .duracaoMinutos(0)
                .status(StatusVisita.GPS_INTERROMPIDO)
                .encerradaSemSinal(true)
                .build();
    }

    private static CheckoutRequest checkoutComHoraReal(Instant ocorridoEm) {
        return new CheckoutRequest(null, null, null, ocorridoEm, null);
    }

    @Test
    void checkoutAtrasadoCorrigeVisitaEncerradaPeloJobComAHoraRealDaSaida() {
        Instant entrada = Instant.now().minus(Duration.ofHours(2));
        VisitaDocument visita = visitaEncerradaPeloJob(entrada);
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visita));
        Instant saidaReal = entrada.plus(Duration.ofMinutes(38));

        CheckoutResponse resposta = visitaService.checkout("v9", checkoutComHoraReal(saidaReal), "u1");

        assertEquals(StatusVisita.FINALIZADA, resposta.status());
        assertEquals(saidaReal, resposta.saida());
        assertEquals(38, resposta.duracaoMinutos());
        assertNull(visita.getEncerradaSemSinal());
        assertNotNull(visita.getProcessadoEm());
    }

    @Test
    void checkoutAtrasadoSoCorrigeSeAVisitaContinuaComoOJobDeixou() {
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visitaEncerradaPeloJob(Instant.now().minus(Duration.ofHours(1)))));

        visitaService.checkout("v9", checkoutComHoraReal(Instant.now().minus(Duration.ofMinutes(20))), "u1");

        ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).findAndModify(query.capture(), any(Update.class),
                any(FindAndModifyOptions.class), eq(VisitaDocument.class));
        Document filtro = query.getValue().getQueryObject();
        assertEquals(StatusVisita.GPS_INTERROMPIDO, filtro.get("status"));
        assertEquals(true, filtro.get("encerradaSemSinal"));
    }

    @Test
    void checkoutManualAtrasadoContinuaMarcadoComoEncerramentoManual() {
        Instant entrada = Instant.now().minus(Duration.ofHours(1));
        VisitaDocument visita = visitaEncerradaPeloJob(entrada);
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visita));

        CheckoutRequest naoEstouAqui = new CheckoutRequest(null, null, true, entrada.plus(Duration.ofMinutes(12)), null);
        CheckoutResponse resposta = visitaService.checkout("v9", naoEstouAqui, "u1");

        assertTrue(resposta.encerramentoManual());
        assertEquals(12, resposta.duracaoMinutos());
    }

    @Test
    void segundaCopiaDoCheckoutAtrasadoRecebeConflito() {
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visitaEncerradaPeloJob(Instant.now().minus(Duration.ofHours(1)))));
        when(mongoTemplate.findAndModify(any(Query.class), any(Update.class),
                any(FindAndModifyOptions.class), eq(VisitaDocument.class))).thenReturn(null);

        CheckoutRequest pedido = checkoutComHoraReal(Instant.now().minus(Duration.ofMinutes(20)));
        assertThrows(ConflitoException.class, () -> visitaService.checkout("v9", pedido, "u1"));
    }

    @Test
    void checkoutAtrasadoSemHoraRealNaoMudaAVisitaEncerradaPeloJob() {
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visitaEncerradaPeloJob(Instant.now().minus(Duration.ofHours(1)))));

        CheckoutRequest semHora = checkoutComHoraReal(null);
        assertThrows(ConflitoException.class, () -> visitaService.checkout("v9", semHora, "u1"));
        verify(mongoTemplate, never()).findAndModify(any(Query.class), any(Update.class),
                any(FindAndModifyOptions.class), eq(VisitaDocument.class));
    }

    @Test
    void checkoutAtrasadoComHoraForaDaJanelaDe24hNaoCorrige() {
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visitaEncerradaPeloJob(Instant.now().minus(Duration.ofHours(30)))));

        CheckoutRequest antigo = checkoutComHoraReal(Instant.now().minus(Duration.ofHours(25)));
        assertThrows(ConflitoException.class, () -> visitaService.checkout("v9", antigo, "u1"));
        CheckoutRequest futuro = checkoutComHoraReal(Instant.now().plus(Duration.ofMinutes(10)));
        assertThrows(ConflitoException.class, () -> visitaService.checkout("v9", futuro, "u1"));
    }

    @Test
    void checkoutAtrasadoNaoCorrigeGpsInterrompidoInformadoPeloAparelho() {
        VisitaDocument peloAparelho = visitaEncerradaPeloJob(Instant.now().minus(Duration.ofHours(1)));
        peloAparelho.setEncerradaSemSinal(null);
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(peloAparelho));

        CheckoutRequest pedido = checkoutComHoraReal(Instant.now().minus(Duration.ofMinutes(20)));
        assertThrows(ConflitoException.class, () -> visitaService.checkout("v9", pedido, "u1"));
    }

    @Test
    void checkoutAtrasadoComGpsIndisponivelConfirmaOGpsInterrompido() {
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visitaEncerradaPeloJob(Instant.now().minus(Duration.ofHours(1)))));

        CheckoutRequest semGps = new CheckoutRequest(null, true, null, Instant.now().minus(Duration.ofMinutes(20)), null);
        assertThrows(ConflitoException.class, () -> visitaService.checkout("v9", semGps, "u1"));
    }

    @Test
    void checkoutAtrasadoDeOutroDonoLancaAcessoNegado() {
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(visitaEncerradaPeloJob(Instant.now().minus(Duration.ofHours(1)))));

        CheckoutRequest pedido = checkoutComHoraReal(Instant.now().minus(Duration.ofMinutes(20)));
        assertThrows(AcessoNegadoException.class, () -> visitaService.checkout("v9", pedido, "invasor"));
    }

    @Test
    void checkoutAtrasadoNaoDeixaASaidaAntesDaEntradaNemNoFuturo() {
        Instant entrada = Instant.now().minus(Duration.ofMinutes(30));
        VisitaDocument antesDaEntrada = visitaEncerradaPeloJob(entrada);
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(antesDaEntrada));

        CheckoutResponse resposta = visitaService.checkout("v9", checkoutComHoraReal(entrada.minus(Duration.ofMinutes(5))), "u1");
        assertEquals(entrada, resposta.saida());
        assertEquals(0, resposta.duracaoMinutos());

        VisitaDocument relogioAdiantado = visitaEncerradaPeloJob(entrada);
        when(visitaRepository.findById("v9")).thenReturn(Optional.of(relogioAdiantado));
        Instant antes = Instant.now();
        CheckoutResponse adiantada = visitaService.checkout("v9", checkoutComHoraReal(antes.plus(Duration.ofMinutes(2))), "u1");
        assertFalse(adiantada.saida().isAfter(Instant.now()));
        assertFalse(adiantada.saida().isBefore(antes));
    }
}
