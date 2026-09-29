package br.com.saude_monitor.api.feedback.seed;

import br.com.saude_monitor.api.feedback.document.FeedbackDocument;
import br.com.saude_monitor.api.feedback.document.FezTriagem;
import br.com.saude_monitor.api.feedback.document.FoiAtendido;
import br.com.saude_monitor.api.feedback.document.MedicacaoReceita;
import br.com.saude_monitor.api.feedback.document.TeveMedico;
import br.com.saude_monitor.api.feedback.seed.MassaAvaliacoesGerador.Perfil;
import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.visita.document.StatusVisita;
import br.com.saude_monitor.api.visita.document.TipoPermanencia;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

class MassaAvaliacoesGeradorTest {

    private static final Instant AGORA = Instant.parse("2026-09-29T12:00:00Z");
    private static final List<String> USUARIOS = IntStream.rangeClosed(1, 30)
            .mapToObj(i -> "usuario-" + i).toList();

    /** 200 hospitais: 20 HOSPITAL, 30 UPA, 150 UBS — a maioria é UBS, como na base real. */
    private static List<HospitalDocument> hospitais() {
        return IntStream.range(0, 200)
                .mapToObj(i -> HospitalDocument.builder()
                        .id("h-%03d".formatted(i))
                        .categoria(i < 20 ? CategoriaEstabelecimento.HOSPITAL
                                : i < 50 ? CategoriaEstabelecimento.UPA
                                : CategoriaEstabelecimento.UBS)
                        .ativo(true)
                        .build())
                .toList();
    }

    private static MassaAvaliacoesGerador.Massa gerar() {
        return new MassaAvaliacoesGerador(MassaAvaliacoesRunner.SEMENTE, AGORA).gerar(hospitais(), USUARIOS);
    }

    @Test
    void distribuiOsPerfisNasQuantidadesDefinidasEDeixaORestoSemAvaliacao() {
        MassaAvaliacoesGerador.Massa massa = gerar();

        Map<Perfil, Long> porPerfil = massa.perfilPorHospital().values().stream()
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        MassaAvaliacoesGerador.HOSPITAIS_POR_PERFIL.forEach((perfil, quantidade) ->
                assertThat(porPerfil.get(perfil)).as(perfil.name()).isEqualTo(quantidade.longValue()));

        Set<String> comAvaliacao = massa.feedbacks().stream().map(FeedbackDocument::getHospitalId).collect(Collectors.toSet());
        assertThat(comAvaliacao).containsExactlyInAnyOrderElementsOf(massa.perfilPorHospital().keySet());
        assertThat(comAvaliacao).hasSizeLessThan(hospitais().size());
    }

    @Test
    void intercalaCategoriasParaORankingNaoFicarSoComUbs() {
        Map<String, CategoriaEstabelecimento> categoria = hospitais().stream()
                .collect(Collectors.toMap(HospitalDocument::getId, HospitalDocument::getCategoria));

        Set<CategoriaEstabelecimento> categorias = gerar().perfilPorHospital().keySet().stream()
                .map(categoria::get).collect(Collectors.toSet());

        assertThat(categorias).containsExactlyInAnyOrder(
                CategoriaEstabelecimento.HOSPITAL, CategoriaEstabelecimento.UPA, CategoriaEstabelecimento.UBS);
    }

    @Test
    void perfisProduzemMediasOrdenadasEPoucasAvaliacoesFicaAbaixoDoMinimo() {
        MassaAvaliacoesGerador.Massa massa = gerar();
        Map<String, List<FeedbackDocument>> porHospital = massa.feedbacks().stream()
                .collect(Collectors.groupingBy(FeedbackDocument::getHospitalId));

        Map<Perfil, Double> mediaPorPerfil = massa.perfilPorHospital().entrySet().stream()
                .collect(Collectors.groupingBy(Map.Entry::getValue, Collectors.averagingDouble(e ->
                        porHospital.get(e.getKey()).stream().mapToInt(FeedbackDocument::getNota).average().orElseThrow())));

        assertThat(mediaPorPerfil.get(Perfil.EXCELENTE)).isGreaterThan(mediaPorPerfil.get(Perfil.BOM));
        assertThat(mediaPorPerfil.get(Perfil.BOM)).isGreaterThan(mediaPorPerfil.get(Perfil.REGULAR));
        assertThat(mediaPorPerfil.get(Perfil.REGULAR)).isGreaterThan(mediaPorPerfil.get(Perfil.RUIM));

        massa.perfilPorHospital().forEach((hospitalId, perfil) -> {
            int avaliacoes = porHospital.get(hospitalId).size();
            if (perfil == Perfil.POUCAS_AVALIACOES) {
                assertThat(avaliacoes).as(hospitalId).isBetween(1, 4); // RN-15: indicadores indisponíveis
            } else {
                assertThat(avaliacoes).as(hospitalId).isGreaterThanOrEqualTo(5);
            }
        });
    }

    @Test
    void respostasSeguemAsRegrasDoFormulario() {
        for (FeedbackDocument f : gerar().feedbacks()) {
            assertThat(f.getNota()).isBetween(1, 5);
            if (f.getFezTriagem() != FezTriagem.SIM) {
                assertThat(f.getEspecialidadeProcurada()).isNull();
                assertThat(f.getFoiAtendido()).isNull();
            } else {
                assertThat(MassaAvaliacoesGerador.ESPECIALIDADES).contains(f.getEspecialidadeProcurada());
                assertThat(f.getFoiAtendido()).isNotNull();
            }
            assertThat(f.getMotivoNaoAtendido() != null).isEqualTo(f.getFoiAtendido() == FoiAtendido.NAO);
            if (f.getTeveMedico() != TeveMedico.SIM) {
                assertThat(f.getMedicacaoReceita()).isEqualTo(MedicacaoReceita.NAO_RECEBEU);
            }
            if (f.getComentario() != null) {
                assertThat(f.getComentario()).hasSizeLessThanOrEqualTo(500);
            }
            if (f.getTratamentoEquipe() != null) {
                assertThat(f.getTratamentoEquipe()).isBetween(1, 5);
            }
            assertThat(f.isAnonimizado()).isEqualTo(f.getUsuarioId() == null);
        }
    }

    @Test
    void cadaAvaliacaoApontaParaUmaVisitaFinalizadaDoMesmoHospitalEDono() {
        MassaAvaliacoesGerador.Massa massa = gerar();
        Map<String, VisitaDocument> visitas = massa.visitas().stream()
                .collect(Collectors.toMap(VisitaDocument::getId, Function.identity()));

        assertThat(massa.feedbacks()).extracting(FeedbackDocument::getVisitaId).doesNotHaveDuplicates();
        for (FeedbackDocument f : massa.feedbacks()) {
            VisitaDocument v = visitas.get(f.getVisitaId());
            assertThat(v).isNotNull();
            assertThat(v.getStatus()).isEqualTo(StatusVisita.FINALIZADA);
            assertThat(v.getHospitalId()).isEqualTo(f.getHospitalId());
            assertThat(v.getUsuarioId()).isEqualTo(f.getUsuarioId());
            assertThat(f.getCriadoEm()).isAfter(v.getSaida()).isBeforeOrEqualTo(AGORA);
        }
        assertThat(massa.visitas()).anyMatch(v -> v.getStatus() == StatusVisita.SEM_FEEDBACK);
        assertThat(massa.visitas()).anyMatch(v -> v.getTipoPermanencia() != TipoPermanencia.ATENDIMENTO);
    }

    @Test
    void visitasFicamNaJanelaDosIndicadoresComDuracaoCoerente() {
        Instant inicioJanela = AGORA.minus(Duration.ofDays(90));
        for (VisitaDocument v : gerar().visitas()) {
            assertThat(v.getId()).startsWith(MassaAvaliacoesGerador.PREFIXO_ID);
            assertThat(v.getEntrada()).isAfter(inicioJanela);
            assertThat(v.getSaida()).isBefore(AGORA);
            assertThat(Duration.between(v.getEntrada(), v.getSaida()).toMinutes()).isEqualTo(v.getDuracaoMinutos().longValue());
            assertThat(v.getDuracaoMinutos()).isBetween(2, 24 * 60);
            assertThat(v.getUsuarioId() == null).isEqualTo(v.getDispositivoId() != null);
        }
    }

    @Test
    void mesmaSementeGeraAMesmaMassa() {
        MassaAvaliacoesGerador.Massa a = gerar();
        MassaAvaliacoesGerador.Massa b = gerar();

        assertThat(a.perfilPorHospital()).isEqualTo(b.perfilPorHospital());
        assertThat(a.feedbacks()).extracting(FeedbackDocument::getNota)
                .containsExactlyElementsOf(b.feedbacks().stream().map(FeedbackDocument::getNota).toList());
    }

    @Test
    void semUsuariosTodasAsAvaliacoesSaoAnonimas() {
        MassaAvaliacoesGerador.Massa massa = new MassaAvaliacoesGerador(1L, AGORA).gerar(hospitais(), List.of());

        assertThat(massa.feedbacks()).isNotEmpty().allMatch(FeedbackDocument::isAnonimizado);
    }

    @Test
    void basePequenaUsaTodosOsHospitaisDisponiveis() {
        List<HospitalDocument> poucos = hospitais().subList(0, 3);

        MassaAvaliacoesGerador.Massa massa = new MassaAvaliacoesGerador(1L, AGORA).gerar(poucos, USUARIOS);

        assertThat(massa.perfilPorHospital()).hasSize(3);
    }
}
