package br.com.saude_monitor.api.hospital.seed;

import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.regiao.service.RegiaoAdministrativaResolver;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Testes da reconciliação de {@code regiaoAdministrativa} dos hospitais já gravados (E7-03).
 *
 * <p>Mocka {@link RegiaoAdministrativaResolver} — a resolução geométrica em si já é
 * testada em {@code RegiaoAdministrativaResolverTest} contra o GeoJSON real; aqui o que
 * está sob teste é o laço de reconciliação (quem é tocado, quem é preservado, paginação).</p>
 */
class ReconciliacaoRegiaoAdministrativaRunnerTest {

    private static final double LAT = -15.9023;
    private static final double LON = -48.0742;

    private final HospitalRepository repository = mock(HospitalRepository.class);
    private final RegiaoAdministrativaResolver resolver = mock(RegiaoAdministrativaResolver.class);
    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final BulkOperations bulkOps = mock(BulkOperations.class);

    private final ReconciliacaoRegiaoAdministrativaRunner runner =
            new ReconciliacaoRegiaoAdministrativaRunner(repository, resolver, mongoTemplate);

    {
        when(mongoTemplate.bulkOps(eq(BulkOperations.BulkMode.UNORDERED), eq(HospitalDocument.class)))
                .thenReturn(bulkOps);
    }

    private record Atualizacao(String hospitalId, String regiao) {
    }

    private HospitalDocument hospital(String id, String regiaoAtual, GeoJsonPoint localizacao) {
        return HospitalDocument.builder()
                .id(id)
                .nome("Unidade " + id)
                .regiaoAdministrativa(regiaoAtual)
                .localizacao(localizacao)
                .ativo(true)
                .build();
    }

    private void comPagina(List<HospitalDocument> conteudo) {
        Pageable pageable = PageRequest.of(0, 200);
        when(repository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(conteudo, pageable, conteudo.size()));
    }

    private List<Atualizacao> capturarAtualizacoes() {
        List<Atualizacao> capturadas = new ArrayList<>();
        doAnswer(invocacao -> {
            Query query = invocacao.getArgument(0);
            Update update = invocacao.getArgument(1);
            String id = (String) query.getQueryObject().get("id");
            Document set = (Document) update.getUpdateObject().get("$set");
            capturadas.add(new Atualizacao(id, (String) set.get("regiaoAdministrativa")));
            return bulkOps;
        }).when(bulkOps).updateOne(any(Query.class), any(Update.class));
        return capturadas;
    }

    @Test
    void devePreencherRegiaoDeHospitalSemEla() {
        comPagina(List.of(hospital("h1", null, new GeoJsonPoint(LON, LAT))));
        when(resolver.resolver(LON, LAT)).thenReturn(Optional.of("Recanto das Emas"));
        List<Atualizacao> atualizacoes = capturarAtualizacoes();

        runner.run(null);

        assertThat(atualizacoes).containsExactly(new Atualizacao("h1", "Recanto das Emas"));
        verify(bulkOps).execute();
    }

    @Test
    void naoRecalculaQuemJaTemRegiaoPreenchida() {
        comPagina(List.of(hospital("h1", "Plano Piloto", new GeoJsonPoint(LON, LAT))));

        runner.run(null);

        verify(resolver, never()).resolver(any(Double.class), any(Double.class));
        verify(bulkOps, never()).updateOne(any(Query.class), any(Update.class));
        verify(bulkOps, never()).execute();
    }

    @Test
    void ignoraHospitalSemLocalizacao() {
        comPagina(List.of(hospital("h1", null, null)));

        runner.run(null);

        verify(resolver, never()).resolver(any(Double.class), any(Double.class));
        verify(bulkOps, never()).updateOne(any(Query.class), any(Update.class));
    }

    @Test
    void naoGravaQuandoOPontoCaiForaDeTodaRegiaoMapeada() {
        comPagina(List.of(hospital("h1", null, new GeoJsonPoint(0.0, 0.0))));
        when(resolver.resolver(0.0, 0.0)).thenReturn(Optional.empty());

        runner.run(null);

        verify(bulkOps, never()).updateOne(any(Query.class), any(Update.class));
        verify(bulkOps, never()).execute();
    }

    @Test
    void deveSerIdempotenteNaSegundaExecucao() {
        HospitalDocument h1 = hospital("h1", null, new GeoJsonPoint(LON, LAT));
        comPagina(List.of(h1));
        when(resolver.resolver(LON, LAT)).thenReturn(Optional.of("Recanto das Emas"));
        List<Atualizacao> primeiraPassada = capturarAtualizacoes();

        runner.run(null); // primeira: preenche

        assertThat(primeiraPassada).hasSize(1);
        // Reflete no documento em memória o que a reconciliação de verdade teria gravado.
        h1.setRegiaoAdministrativa(primeiraPassada.getFirst().regiao());

        List<Atualizacao> segundaPassada = capturarAtualizacoes();
        runner.run(null); // segunda: já preenchido, nada a fazer

        assertThat(segundaPassada).isEmpty();
    }

    @Test
    void devePercorrerTodasAsPaginas() {
        Pageable primeira = PageRequest.of(0, 1);
        Page<HospitalDocument> pagina1 = new PageImpl<>(
                List.of(hospital("h1", null, new GeoJsonPoint(LON, LAT))), primeira, 2);
        Page<HospitalDocument> pagina2 = new PageImpl<>(
                List.of(hospital("h2", null, new GeoJsonPoint(LON, LAT))), PageRequest.of(1, 1), 2);
        when(repository.findAll(any(Pageable.class))).thenReturn(pagina1, pagina2);
        when(resolver.resolver(LON, LAT)).thenReturn(Optional.of("Recanto das Emas"));
        List<Atualizacao> atualizacoes = capturarAtualizacoes();

        runner.run(null);

        assertThat(atualizacoes).extracting(Atualizacao::hospitalId).containsExactly("h1", "h2");
        verify(repository, times(2)).findAll(any(Pageable.class));
    }
}
