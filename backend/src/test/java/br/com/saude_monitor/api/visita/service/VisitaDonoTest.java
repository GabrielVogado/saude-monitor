package br.com.saude_monitor.api.visita.service;

import br.com.saude_monitor.api.visita.document.VisitaDocument;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class VisitaDonoTest {

    private VisitaDocument criarVisitaLogada(String usuarioId) {
        return VisitaDocument.builder().usuarioId(usuarioId).dispositivoId("anon-a").build();
    }

    private VisitaDocument criarVisitaAnonima(String dispositivoId) {
        return VisitaDocument.builder().dispositivoId(dispositivoId).build();
    }

    @Test
    void visitaLogadaPertenceSoAoMesmoUsuario() {
        assertThat(VisitaDono.isDonoDaVisita(criarVisitaLogada("u1"), "u1", null)).isTrue();
        assertThat(VisitaDono.isDonoDaVisita(criarVisitaLogada("u1"), "u2", null)).isFalse();
        assertThat(VisitaDono.isDonoDaVisita(criarVisitaLogada("u1"), null, null)).isFalse();
        // O aparelho não substitui o usuário numa visita logada.
        assertThat(VisitaDono.isDonoDaVisita(criarVisitaLogada("u1"), null, "anon-a")).isFalse();
    }

    @Test
    void visitaAnonimaPertenceSoAoMesmoAparelho() {
        assertThat(VisitaDono.isDonoDaVisita(criarVisitaAnonima("anon-a"), null, "anon-a")).isTrue();
        assertThat(VisitaDono.isDonoDaVisita(criarVisitaAnonima("anon-a"), "u1", "anon-a")).isTrue();
        assertThat(VisitaDono.isDonoDaVisita(criarVisitaAnonima("anon-a"), null, "anon-b")).isFalse();
        assertThat(VisitaDono.isDonoDaVisita(criarVisitaAnonima("anon-a"), null, null)).isFalse();
        assertThat(VisitaDono.isDonoDaVisita(criarVisitaAnonima("anon-a"), "u1", null)).isFalse();
    }

    @Test
    void visitaAnonimaSemAparelhoGravadoNaoTemDono() {
        assertThat(VisitaDono.isDonoDaVisita(criarVisitaAnonima(null), null, "anon-a")).isFalse();
        assertThat(VisitaDono.isDonoDaVisita(criarVisitaAnonima(" "), null, " ")).isFalse();
    }
}
