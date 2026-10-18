package br.com.saude_monitor.api.auth.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Piso de tempo de resposta do "esqueci a senha" e do reenvio (SOL-09). */
class TempoMinimoRespostaTest {

    private static final Duration PISO = Duration.ofSeconds(2);

    private final AtomicLong nanos = new AtomicLong();
    private final List<Duration> esperas = new ArrayList<>();
    private final TempoMinimoResposta tempo = new TempoMinimoResposta(PISO, nanos::get, esperas::add);

    @AfterEach
    void limparInterrupcao() {
        Thread.interrupted();
    }

    @Test
    void operacaoRapidaEsperaOQueFaltaParaOPiso() {
        String resultado = tempo.garantir(() -> {
            nanos.addAndGet(Duration.ofMillis(300).toNanos());
            return "ok";
        });

        assertThat(resultado).isEqualTo("ok");
        assertThat(esperas).containsExactly(Duration.ofMillis(1700));
    }

    @Test
    void operacaoMaisLentaQueOPisoNaoEspera() {
        tempo.garantir(() -> nanos.addAndGet(Duration.ofMillis(2500).toNanos()));

        assertThat(esperas).isEmpty();
    }

    @Test
    void erroTambemSaiSoDepoisDoPiso() {
        assertThatThrownBy(() -> tempo.garantir(() -> {
            throw new IllegalStateException("Mongo fora");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(esperas).containsExactly(PISO);
    }

    @Test
    void interrupcaoDuranteAEsperaPreservaOSinal() {
        TempoMinimoResposta interrompido = new TempoMinimoResposta(PISO, nanos::get, duracao -> {
            throw new InterruptedException("desligando");
        });

        assertThat(interrompido.garantir(() -> "ok")).isEqualTo("ok");
        assertThat(Thread.currentThread().isInterrupted()).isTrue();
    }

    @Test
    void semPisoNaoEspera() {
        assertThat(TempoMinimoResposta.semPiso().garantir(() -> 42)).isEqualTo(42);
        assertThat(new TempoMinimoResposta()).isNotNull();
    }
}
