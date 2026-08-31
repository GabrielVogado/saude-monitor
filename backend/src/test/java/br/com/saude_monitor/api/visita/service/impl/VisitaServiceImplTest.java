package br.com.saude_monitor.api.visita.service.impl;

import br.com.saude_monitor.api.config.exception.NaoAutorizadoException;
import br.com.saude_monitor.api.config.exception.ValidacaoNegocioException;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.visita.document.OrigemVisita;
import br.com.saude_monitor.api.visita.document.StatusVisita;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import br.com.saude_monitor.api.visita.dto.CheckinRequest;
import br.com.saude_monitor.api.visita.dto.CheckinResponse;
import br.com.saude_monitor.api.visita.dto.VisitaAtivaResponse;
import br.com.saude_monitor.api.visita.repository.VisitaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;

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
        CheckinRequest request = new CheckinRequest("h1", OrigemVisita.MANUAL, null, null);

        assertThrows(ValidacaoNegocioException.class, () -> visitaService.checkin(request, null));
        verify(visitaRepository, never()).save(any(VisitaDocument.class));
    }

    @Test
    void checkinAnonimoComDispositivoIdCriaVisita() {
        when(hospitalRepository.findById("h1")).thenReturn(Optional.of(hospitalAtivo("h1")));
        when(visitaRepository.findFirstByDispositivoIdAndHospitalIdAndStatusInOrderByEntradaDesc(
                anyString(), anyString(), any())).thenReturn(Optional.empty());
        when(visitaRepository.save(any(VisitaDocument.class))).thenAnswer(inv -> {
            VisitaDocument v = inv.getArgument(0);
            v.setId("v9");
            return v;
        });

        CheckinRequest request = new CheckinRequest("h1", OrigemVisita.MANUAL, null, "anon-abc");
        CheckinResponse resposta = visitaService.checkin(request, null);

        assertTrue(resposta.criado());
        assertEquals("v9", resposta.id());
        verify(visitaRepository).save(any(VisitaDocument.class));
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
}