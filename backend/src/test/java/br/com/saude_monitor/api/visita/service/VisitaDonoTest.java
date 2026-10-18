package br.com.saude_monitor.api.visita.service;

import br.com.saude_monitor.api.visita.document.VisitaDocument;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class VisitaDonoTest {

    private VisitaDocument logada(String usuarioId) {
        return VisitaDocument.builder().usuarioId(usuarioId).dispositivoId("anon-a").build();
    }

    private VisitaDocument anonima(String dispositivoId) {
        return VisitaDocument.builder().dispositivoId(dispositivoId).build();
    }

    @Test
    void visitaLogadaPertenceSoAoMesmoUsuario() {
        assertThat(VisitaDono.pertenceA(logada("u1"), "u1", null)).isTrue();
        assertThat(VisitaDono.pertenceA(logada("u1"), "u2", null)).isFalse();
        assertThat(VisitaDono.pertenceA(logada("u1"), null, null)).isFalse();
        // O aparelho não substitui o usuário numa visita logada.
        assertThat(VisitaDono.pertenceA(logada("u1"), null, "anon-a")).isFalse();
    }

    @Test
    void visitaAnonimaPertenceSoAoMesmoAparelho() {
        assertThat(VisitaDono.pertenceA(anonima("anon-a"), null, "anon-a")).isTrue();
        assertThat(VisitaDono.pertenceA(anonima("anon-a"), "u1", "anon-a")).isTrue();
        assertThat(VisitaDono.pertenceA(anonima("anon-a"), null, "anon-b")).isFalse();
        assertThat(VisitaDono.pertenceA(anonima("anon-a"), null, null)).isFalse();
        assertThat(VisitaDono.pertenceA(anonima("anon-a"), "u1", null)).isFalse();
    }

    @Test
    void visitaAnonimaSemAparelhoGravadoNaoTemDono() {
        assertThat(VisitaDono.pertenceA(anonima(null), null, "anon-a")).isFalse();
        assertThat(VisitaDono.pertenceA(anonima(" "), null, " ")).isFalse();
    }
}
