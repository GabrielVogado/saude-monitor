package br.com.saude_monitor.api.auth.service;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

/** Limite de códigos por endereço de destino (SEG-03). */
class LimiteEnvioEmailTest {

    private static final Instant INICIO = Instant.parse("2026-10-18T12:00:00Z");

    @Test
    void permiteOMaximoPorJanelaERecusaOSeguinteMesmoMudandoACaixa() {
        LimiteEnvioEmail limite = new LimiteEnvioEmail(Clock.fixed(INICIO, ZoneOffset.UTC));

        for (int i = 0; i < LimiteEnvioEmail.MAXIMO_POR_JANELA; i++) {
            assertThat(limite.tentarRegistrarEnvio("marina@email.com")).isTrue();
        }
        assertThat(limite.tentarRegistrarEnvio(" Marina@Email.com ")).isFalse();
        assertThat(limite.tentarRegistrarEnvio("outra@email.com")).isTrue();
    }

    @Test
    void novaJanelaZeraAContagem() {
        LimiteEnvioEmail antes = new LimiteEnvioEmail(Clock.fixed(INICIO, ZoneOffset.UTC));
        for (int i = 0; i <= LimiteEnvioEmail.MAXIMO_POR_JANELA; i++) {
            antes.tentarRegistrarEnvio("marina@email.com");
        }
        assertThat(antes.tentarRegistrarEnvio("marina@email.com")).isFalse();

        Clock depois = Clock.fixed(INICIO.plus(LimiteEnvioEmail.JANELA), ZoneOffset.UTC);
        LimiteEnvioEmail mesmoContador = new LimiteEnvioEmail(depois);
        assertThat(mesmoContador.tentarRegistrarEnvio("marina@email.com")).isTrue();
        assertThat(new LimiteEnvioEmail()).isNotNull();
    }
}
