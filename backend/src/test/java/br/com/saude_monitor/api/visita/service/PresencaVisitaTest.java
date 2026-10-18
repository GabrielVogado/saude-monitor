package br.com.saude_monitor.api.visita.service;

import br.com.saude_monitor.api.visita.document.OrigemVisita;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Regra de prova de presença do SEG-01. */
class PresencaVisitaTest {

    private static final Instant AGORA = Instant.parse("2026-10-18T15:00:00Z");

    @Test
    void checkinComPosicaoNoHospitalNoMomentoComprova() {
        assertTrue(PresencaVisita.noCheckin(true, AGORA, AGORA));
    }

    @Test
    void checkinSemPosicaoNoHospitalNaoComprova() {
        assertFalse(PresencaVisita.noCheckin(false, AGORA, AGORA));
    }

    @Test
    void checkinRetroativoAte45MinutosComprova() {
        assertTrue(PresencaVisita.noCheckin(true, AGORA.minusSeconds(45 * 60), AGORA));
    }

    @Test
    void checkinRetroativoAlemDe45MinutosNaoComprova() {
        assertFalse(PresencaVisita.noCheckin(true, AGORA.minusSeconds(46 * 60), AGORA));
    }

    @Test
    void marcacaoGravadaPrevalece() {
        VisitaDocument manualComprovada = VisitaDocument.builder()
                .origem(OrigemVisita.MANUAL).presencaComprovada(true).build();
        VisitaDocument geofenceNaoComprovada = VisitaDocument.builder()
                .origem(OrigemVisita.GEOFENCE).entrada(AGORA).criadoEm(AGORA).presencaComprovada(false).build();

        assertTrue(PresencaVisita.comprovada(manualComprovada));
        assertFalse(PresencaVisita.comprovada(geofenceNaoComprovada));
    }

    @Test
    void visitaAntigaPeloGeofenceSemAtrasoComprova() {
        VisitaDocument antiga = VisitaDocument.builder()
                .origem(OrigemVisita.GEOFENCE).entrada(AGORA.minusSeconds(60)).criadoEm(AGORA).build();

        assertTrue(PresencaVisita.comprovada(antiga));
    }

    @Test
    void visitaAntigaManualNaoComprova() {
        VisitaDocument antiga = VisitaDocument.builder()
                .origem(OrigemVisita.MANUAL).entrada(AGORA).criadoEm(AGORA).build();

        assertFalse(PresencaVisita.comprovada(antiga));
    }

    @Test
    void visitaAntigaRetroativaOuSemDatasNaoComprova() {
        VisitaDocument retroativa = VisitaDocument.builder()
                .origem(OrigemVisita.GEOFENCE).entrada(AGORA.minusSeconds(3 * 3600)).criadoEm(AGORA).build();
        VisitaDocument semCriadoEm = VisitaDocument.builder()
                .origem(OrigemVisita.GEOFENCE).entrada(AGORA).build();
        VisitaDocument semEntrada = VisitaDocument.builder()
                .origem(OrigemVisita.GEOFENCE).criadoEm(AGORA).build();

        assertFalse(PresencaVisita.comprovada(retroativa));
        assertFalse(PresencaVisita.comprovada(semCriadoEm));
        assertFalse(PresencaVisita.comprovada(semEntrada));
    }
}
