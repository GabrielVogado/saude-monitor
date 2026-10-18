package br.com.saude_monitor.api.visita.service.impl;

import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.visita.document.OrigemVisita;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import br.com.saude_monitor.api.visita.dto.CheckinRequest;
import br.com.saude_monitor.api.visita.dto.PosicaoDto;
import br.com.saude_monitor.api.visita.repository.VisitaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Marcação de prova de presença gravada no check-in (SEG-01). */
class VisitaPresencaCheckinTest {

    private static final PosicaoDto POSICAO = new PosicaoDto("Point", List.of(-48.0742, -15.9023));

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

        when(hospitalRepository.findById("h1"))
                .thenReturn(Optional.of(HospitalDocument.builder().id("h1").ativo(true).build()));
        when(visitaRepository.findFirstByDispositivoIdAndStatusInOrderByEntradaDesc(anyString(), any()))
                .thenReturn(Optional.empty());
        when(visitaRepository.save(any(VisitaDocument.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private VisitaDocument checkin(OrigemVisita origem, PosicaoDto posicao, Instant ocorridoEm) {
        visitaService.checkin(new CheckinRequest("h1", origem, posicao, "anon-1", ocorridoEm), null);
        ArgumentCaptor<VisitaDocument> salva = ArgumentCaptor.forClass(VisitaDocument.class);
        verify(visitaRepository).save(salva.capture());
        return salva.getValue();
    }

    @Test
    void manualSemPosicaoNaoComprovaENaoConsultaGeofence() {
        VisitaDocument visita = checkin(OrigemVisita.MANUAL, null, null);

        assertFalse(visita.getPresencaComprovada());
        verify(mongoTemplate, never()).exists(any(Query.class), eq(HospitalDocument.class));
    }

    @Test
    void manualComPosicaoDentroDoHospitalComprova() {
        when(mongoTemplate.exists(any(Query.class), eq(HospitalDocument.class))).thenReturn(true);

        VisitaDocument visita = checkin(OrigemVisita.MANUAL, POSICAO, null);

        assertTrue(visita.getPresencaComprovada());
        ArgumentCaptor<Query> consulta = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).exists(consulta.capture(), eq(HospitalDocument.class));
        assertEquals("h1", consulta.getValue().getQueryObject().get("_id"));
    }

    @Test
    void manualComPosicaoForaDoHospitalEhAceitoMasNaoComprova() {
        when(mongoTemplate.exists(any(Query.class), eq(HospitalDocument.class))).thenReturn(false);

        VisitaDocument visita = checkin(OrigemVisita.MANUAL, POSICAO, null);

        assertFalse(visita.getPresencaComprovada());
    }

    @Test
    void manualComCoordenadaImpossivelEhAceitoSemConsultarGeofence() {
        VisitaDocument longitudeInvalida = checkin(OrigemVisita.MANUAL, new PosicaoDto("Point", List.of(200.0, -15.9)), null);

        assertFalse(longitudeInvalida.getPresencaComprovada());
        verify(mongoTemplate, never()).exists(any(Query.class), eq(HospitalDocument.class));
    }

    @Test
    void manualComLatitudeImpossivelNaoComprova() {
        VisitaDocument latitudeInvalida = checkin(OrigemVisita.MANUAL, new PosicaoDto("Point", List.of(-48.0, -95.0)), null);

        assertFalse(latitudeInvalida.getPresencaComprovada());
        verify(mongoTemplate, never()).exists(any(Query.class), eq(HospitalDocument.class));
    }

    @Test
    void manualRetroativoAlemDe45MinutosNaoComprova() {
        when(mongoTemplate.exists(any(Query.class), eq(HospitalDocument.class))).thenReturn(true);

        VisitaDocument visita = checkin(OrigemVisita.MANUAL, POSICAO, Instant.now().minusSeconds(3 * 3600));

        assertFalse(visita.getPresencaComprovada());
    }

    @Test
    void geofenceComprovaPelaValidacaoDoProprioCheckin() {
        when(mongoTemplate.find(any(Query.class), eq(HospitalDocument.class)))
                .thenReturn(List.of(HospitalDocument.builder().id("h1").ativo(true).build()));

        VisitaDocument visita = checkin(OrigemVisita.GEOFENCE, POSICAO, null);

        assertTrue(visita.getPresencaComprovada());
        verify(mongoTemplate, never()).exists(any(Query.class), eq(HospitalDocument.class));
    }
}
