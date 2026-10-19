package br.com.saude_monitor.api.hospital.service;

import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import br.com.saude_monitor.api.hospital.dto.CatalogoResponse;
import br.com.saude_monitor.api.hospital.dto.HospitalResumoResponse;
import br.com.saude_monitor.api.hospital.dto.IndicadoresResponse;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Catálogo público guardado por instância (ARQ-01). */
class CatalogoServiceTest {

    private static final Instant INICIO = Instant.parse("2026-10-18T12:00:00Z");

    private final HospitalService hospitalService = mock(HospitalService.class);
    private final AtomicReference<Instant> agora = new AtomicReference<>(INICIO);
    private final Clock clock = new Clock() {
        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return agora.get();
        }
    };
    private final CatalogoService service = new CatalogoService(hospitalService, clock);

    private static HospitalResumoResponse criarItem(String id, Double nota) {
        IndicadoresResponse indicadores = nota == null
                ? IndicadoresResponse.indisponivel()
                : new IndicadoresResponse(true, nota, 8, 30, null);
        return new HospitalResumoResponse(id, "Hospital " + id, TipoEstabelecimento.PUBLICO, null, null,
                null, null, 150, true, null, indicadores);
    }

    @Test
    void montaUmaVezEReaproveitaDentroDaValidade() {
        when(hospitalService.listarCatalogo()).thenReturn(List.of(criarItem("a", 4.0), criarItem("b", null)));

        CatalogoResponse primeiro = service.obterCatalogo();
        agora.set(INICIO.plus(CatalogoService.VALIDADE).minusSeconds(1));
        CatalogoResponse segundo = service.obterCatalogo();

        assertThat(segundo).isSameAs(primeiro);
        assertThat(primeiro.total()).isEqualTo(2);
        assertThat(primeiro.estabelecimentos()).extracting(HospitalResumoResponse::id).containsExactly("a", "b");
        verify(hospitalService, times(1)).listarCatalogo();
    }

    @Test
    void remontaDepoisDaValidade() {
        when(hospitalService.listarCatalogo()).thenReturn(List.of(criarItem("a", 4.0)));

        service.obterCatalogo();
        agora.set(INICIO.plus(CatalogoService.VALIDADE));
        service.obterCatalogo();

        verify(hospitalService, times(2)).listarCatalogo();
    }

    @Test
    void invalidarFazAProximaLeituraIrAoBanco() {
        when(hospitalService.listarCatalogo()).thenReturn(List.of(criarItem("a", 4.0)));

        service.obterCatalogo();
        service.invalidarCache();
        service.obterCatalogo();

        verify(hospitalService, times(2)).listarCatalogo();
    }

    @Test
    void versaoSoMudaQuandoOConteudoMuda() {
        when(hospitalService.listarCatalogo())
                .thenReturn(List.of(criarItem("a", 4.0)))
                .thenReturn(List.of(criarItem("a", 4.0)))
                .thenReturn(List.of(criarItem("a", 4.5)));

        String v1 = service.obterCatalogo().versao();
        agora.set(agora.get().plus(Duration.ofMinutes(6)));
        String v2 = service.obterCatalogo().versao();
        agora.set(agora.get().plus(Duration.ofMinutes(6)));
        String v3 = service.obterCatalogo().versao();

        assertThat(v1).hasSize(32).isEqualTo(v2);
        assertThat(v3).isNotEqualTo(v1);
    }
}
