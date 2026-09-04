package br.com.saude_monitor.api.visita.service.impl;

import br.com.saude_monitor.api.config.exception.NaoAutorizadoException;
import br.com.saude_monitor.api.config.exception.ConflitoException;
import br.com.saude_monitor.api.config.exception.ValidacaoNegocioException;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.visita.document.OrigemVisita;
import br.com.saude_monitor.api.visita.document.StatusVisita;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import br.com.saude_monitor.api.hospital.dto.PageResponse;
import br.com.saude_monitor.api.visita.dto.CheckinRequest;
import br.com.saude_monitor.api.visita.dto.CheckinResponse;
import br.com.saude_monitor.api.visita.dto.CheckoutRequest;
import br.com.saude_monitor.api.visita.dto.CheckoutResponse;
import br.com.saude_monitor.api.visita.dto.VisitaAtivaResponse;
import br.com.saude_monitor.api.visita.dto.VisitaResponse;
import br.com.saude_monitor.api.visita.repository.VisitaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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
        when(visitaRepository.save(any(VisitaDocument.class))).thenAnswer(inv -> inv.getArgument(0));

        Instant saidaReal = entrada.plus(Duration.ofMinutes(45));
        CheckoutResponse resposta =
                visitaService.checkout("v9", new CheckoutRequest(null, null, null, saidaReal), "u1");

        assertEquals(saidaReal, resposta.saida());
        assertEquals(45, resposta.duracaoMinutos());
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
        when(visitaRepository.save(any(VisitaDocument.class))).thenAnswer(inv -> inv.getArgument(0));

        // Relógio do aparelho atrasado: sem a proteção, a duração ficaria negativa e
        // envenenaria a mediana de permanência (RN-15).
        Instant saidaImpossivel = entrada.minus(Duration.ofMinutes(30));
        CheckoutResponse resposta =
                visitaService.checkout("v9", new CheckoutRequest(null, null, null, saidaImpossivel), "u1");

        assertEquals(entrada, resposta.saida());
        assertEquals(0, resposta.duracaoMinutos());
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
}