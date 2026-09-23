package br.com.saude_monitor.api.agregado.service;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Testes das funções estatísticas puras da agregação (Épico 04 — RN-14, RN-16, RN-17).
 */
class EstatisticaServiceTest {

    // ------------------------------------------------ RN-14 (média) ------------------------------------------------

    @Test
    void notaMediaRetornaNullQuandoVazia() {
        assertThat(EstatisticaService.notaMedia(List.of())).isNull();
        assertThat(EstatisticaService.notaMedia(null)).isNull();
    }

    @Test
    void notaMediaCalculaMediaAritmetica() {
        assertThat(EstatisticaService.notaMedia(List.of(4, 5, 3))).isEqualTo(4.0);
        assertThat(EstatisticaService.notaMedia(List.of(4, 5))).isEqualTo(4.5);
    }

    @Test
    void notaMediaIgnoraNotasForaDoIntervalo() {
        // 0 e 6 são inválidos (nota 1–5) — devem ser descartados.
        assertThat(EstatisticaService.notaMedia(List.of(0, 4, 6, 5))).isEqualTo(4.5);
    }

    // ------------------------------------------------ RN-16 (mediana) -----------------------------------------------

    @Test
    void medianaRetornaNullQuandoVazia() {
        assertThat(EstatisticaService.tempoMedianoMinutos(List.of())).isNull();
    }

    @Test
    void medianaImparRetornaElementoCentral() {
        Integer[] valores = {30, 90, 120};
        assertThat(EstatisticaService.tempoMedianoMinutos(List.of(valores))).isEqualTo(90);
    }

    @Test
    void medianaParRetornaMediaDosCentrais() {
        // {30, 60, 90, 120} → (60+90)/2 = 75
        Integer[] valores = {30, 60, 90, 120};
        assertThat(EstatisticaService.tempoMedianoMinutos(List.of(valores))).isEqualTo(75);
    }

    @Test
    void medianaOrdenaValoresDesordenados() {
        Integer[] valores = {120, 30, 90};
        assertThat(EstatisticaService.tempoMedianoMinutos(List.of(valores))).isEqualTo(90);
    }

    // ------------------------------------------------ RN-17 (cobertura GPS) -----------------------------------------

    @Test
    void coberturaGpsExige90PorCentoDoPeriodo() {
        Duration total = Duration.ofMinutes(100);
        assertThat(EstatisticaService.coberturaGpsConfiável(total, Duration.ofMinutes(90))).isTrue();
        assertThat(EstatisticaService.coberturaGpsConfiável(total, Duration.ofMinutes(89))).isFalse();
    }

    @Test
    void coberturaGpsRejeitaPeriodoInvalido() {
        assertThat(EstatisticaService.coberturaGpsConfiável(Duration.ZERO, Duration.ofMinutes(10))).isFalse();
        assertThat(EstatisticaService.coberturaGpsConfiável(Duration.ofMinutes(-5), Duration.ofMinutes(10))).isFalse();
        assertThat(EstatisticaService.coberturaGpsConfiável(null, Duration.ofMinutes(10))).isFalse();
    }

    @Test
    void fracaoCobertaEntreInstantes() {
        Instant inicio = Instant.parse("2026-08-01T10:00:00Z");
        Instant fim = Instant.parse("2026-08-01T11:00:00Z"); // 60min de período
        // cobertura até 10:40 → 40/60 = 0.666
        assertThat(EstatisticaService.fracaoCoberta(inicio, fim, Instant.parse("2026-08-01T10:40:00Z")))
                .isEqualTo(40.0 / 60.0);
        // sem posição → 0
        assertThat(EstatisticaService.fracaoCoberta(inicio, fim, null)).isEqualTo(0.0);
        // posição depois do fim → saturado em 1
        assertThat(EstatisticaService.fracaoCoberta(inicio, fim, Instant.parse("2026-08-01T12:00:00Z")))
                .isEqualTo(1.0);
    }
}
