package br.com.saude_monitor.api.hospital.seed;

import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.dto.GeoJsonPolygonDto;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.hospital.service.GeofenceFactory;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.geo.GeoJsonPolygon;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;

/**
 * Testes da reconciliação de raio dos geofences já gravados (BUG-08).
 *
 * <p>Usa o {@link GeofenceFactory} de verdade — a geometria é o que está sob teste;
 * mockar a fábrica testaria apenas o encadeamento de chamadas.</p>
 *
 * <p>A reconciliação grava via update parcial e atômico ({@link BulkOperations}), não
 * via {@code saveAll} do documento inteiro (code-review do PR #85 — evita sobrescrever
 * uma edição administrativa concorrente); os testes capturam o {@link Query}/{@link Update}
 * passados ao bulk em vez de inspecionar o {@link HospitalDocument} salvo.</p>
 */
class ReconciliacaoRaioGeofenceRunnerTest {

    private static final double LAT = -15.9023;
    private static final double LON = -48.0742;

    private final HospitalRepository repository = mock(HospitalRepository.class);
    private final GeofenceFactory factory = new GeofenceFactory();
    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final BulkOperations bulkOps = mock(BulkOperations.class);

    /** Raios de destino: HOSPITAL 150 · UPA/POLICLINICA/CAPS/CENTRO/OUTRO 100 · UBS 75. */
    private final SeedProperties properties = new SeedProperties(
            true, "data/", "UTF-8", "skip-if-not-empty", "LOTE", 0.05,
            150.0, 100.0, 75.0, 100.0, 100.0, 100.0, 100.0);

    private final ReconciliacaoRaioGeofenceRunner runner =
            new ReconciliacaoRaioGeofenceRunner(repository, factory, properties, mongoTemplate);

    {
        when(mongoTemplate.bulkOps(eq(BulkOperations.BulkMode.UNORDERED), eq(HospitalDocument.class)))
                .thenReturn(bulkOps);
    }

    private record Atualizacao(String hospitalId, GeoJsonPolygon geofence, Instant atualizadoEm) {
    }

    private HospitalDocument hospital(CategoriaEstabelecimento categoria, double raioMetros) {
        return HospitalDocument.builder()
                .id("h-" + categoria)
                .nome("Unidade " + categoria)
                .categoria(categoria)
                .localizacao(new GeoJsonPoint(LON, LAT))
                .geofence(factory.criarCirculo(LAT, LON, raioMetros, GeofenceFactory.LADOS_CIRCULO))
                .ativo(true)
                .build();
    }

    private void comPagina(List<HospitalDocument> conteudo) {
        Pageable pageable = PageRequest.of(0, 200);
        when(repository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(conteudo, pageable, conteudo.size()));
    }

    /** Captura as chamadas a {@code bulkOps.updateOne(query, update)} feitas a partir daqui. */
    private List<Atualizacao> capturarAtualizacoes() {
        List<Atualizacao> capturadas = new ArrayList<>();
        doAnswer(invocacao -> {
            Query query = invocacao.getArgument(0);
            Update update = invocacao.getArgument(1);
            String id = (String) query.getQueryObject().get("id");
            Document set = (Document) update.getUpdateObject().get("$set");
            capturadas.add(new Atualizacao(
                    id,
                    (GeoJsonPolygon) set.get("geofence"),
                    (Instant) set.get("atualizadoEm")));
            return bulkOps;
        }).when(bulkOps).updateOne(any(Query.class), any(Update.class));
        return capturadas;
    }

    @Test
    void deveEncolherOCirculoAntigoAteORaioDaCategoria() {
        comPagina(List.of(hospital(CategoriaEstabelecimento.UBS, 100.0)));
        List<Atualizacao> atualizacoes = capturarAtualizacoes();

        runner.run(null);

        assertThat(atualizacoes).hasSize(1);
        Atualizacao ajustada = atualizacoes.getFirst();
        assertThat(factory.raioAproximadoMetros(ajustada.geofence(), new GeoJsonPoint(LON, LAT)))
                .isEqualTo(75);
        assertThat(ajustada.atualizadoEm()).isNotNull();
        verify(bulkOps).execute();
    }

    @Test
    void deveAplicarORaioDeCadaCategoriaNaMesmaPassada() {
        comPagina(List.of(
                hospital(CategoriaEstabelecimento.HOSPITAL, 200.0),
                hospital(CategoriaEstabelecimento.UPA, 150.0),
                hospital(CategoriaEstabelecimento.UBS, 100.0)));
        List<Atualizacao> atualizacoes = capturarAtualizacoes();

        runner.run(null);

        assertThat(atualizacoes).hasSize(3);
        assertThat(atualizacoes)
                .extracting(a -> factory.raioAproximadoMetros(a.geofence(), new GeoJsonPoint(LON, LAT)))
                .containsExactly(150, 100, 75);
    }

    @Test
    void naoDeveGravarQuandoOsRaiosJaEstaoCertos() {
        comPagina(List.of(
                hospital(CategoriaEstabelecimento.HOSPITAL, 150.0),
                hospital(CategoriaEstabelecimento.UBS, 75.0)));

        runner.run(null);

        verify(bulkOps, never()).updateOne(any(Query.class), any(Update.class));
        verify(bulkOps, never()).execute();
    }

    @Test
    void deveSerIdempotenteNaSegundaExecucao() {
        HospitalDocument ubs = hospital(CategoriaEstabelecimento.UBS, 100.0);
        comPagina(List.of(ubs));
        List<Atualizacao> primeiraPassada = capturarAtualizacoes();

        runner.run(null); // primeira passada: encolhe de 100 para 75

        assertThat(primeiraPassada).hasSize(1);
        // Reflete no documento em memória o que a reconciliação de verdade teria gravado
        // no MongoDB, para simular o que a segunda leitura encontraria.
        ubs.setGeofence(primeiraPassada.getFirst().geofence());

        List<Atualizacao> segundaPassada = capturarAtualizacoes();
        runner.run(null); // segunda passada: já está no raio certo, nada a fazer

        assertThat(segundaPassada).isEmpty();
    }

    @Test
    void devePreservarPoligonoDesenhadoAMao() {
        // Terreno retangular de ~200 m x 100 m — não é círculo do produto.
        GeoJsonPolygon terreno = factory.toPolygon(new GeoJsonPolygonDto("Polygon", List.of(
                List.of(List.of(-48.0752, -15.9018), List.of(-48.0732, -15.9018),
                        List.of(-48.0732, -15.9027), List.of(-48.0752, -15.9027),
                        List.of(-48.0752, -15.9018)))));
        HospitalDocument comTerreno = HospitalDocument.builder()
                .id("h-terreno")
                .nome("Hospital com polígono próprio")
                .categoria(CategoriaEstabelecimento.HOSPITAL)
                .localizacao(factory.calcularCentroide(terreno))
                .geofence(terreno)
                .ativo(true)
                .build();
        comPagina(List.of(comTerreno));

        runner.run(null);

        verify(bulkOps, never()).updateOne(any(Query.class), any(Update.class));
        assertThat(comTerreno.getGeofence()).isSameAs(terreno);
    }

    @Test
    void deveIgnorarDocumentoSemGeometriaOuSemCategoria() {
        HospitalDocument semGeofence = hospital(CategoriaEstabelecimento.UBS, 100.0);
        semGeofence.setGeofence(null);
        HospitalDocument semLocalizacao = hospital(CategoriaEstabelecimento.UPA, 150.0);
        semLocalizacao.setLocalizacao(null);
        HospitalDocument semCategoria = hospital(CategoriaEstabelecimento.CAPS, 150.0);
        semCategoria.setCategoria(null);
        comPagina(List.of(semGeofence, semLocalizacao, semCategoria));

        runner.run(null);

        verify(bulkOps, never()).updateOne(any(Query.class), any(Update.class));
    }

    @Test
    void devePercorrerTodasAsPaginas() {
        Pageable primeira = PageRequest.of(0, 1);
        Page<HospitalDocument> pagina1 =
                new PageImpl<>(List.of(hospital(CategoriaEstabelecimento.UBS, 100.0)), primeira, 2);
        Page<HospitalDocument> pagina2 =
                new PageImpl<>(List.of(hospital(CategoriaEstabelecimento.UPA, 150.0)),
                        PageRequest.of(1, 1), 2);
        when(repository.findAll(any(Pageable.class))).thenReturn(pagina1, pagina2);
        List<Atualizacao> atualizacoes = capturarAtualizacoes();

        runner.run(null);

        // As duas páginas foram percorridas e ajustadas: UBS (100→75) na primeira, UPA (150→100) na segunda.
        assertThat(atualizacoes).hasSize(2);
        assertThat(atualizacoes)
                .extracting(a -> factory.raioAproximadoMetros(a.geofence(), new GeoJsonPoint(LON, LAT)))
                .containsExactly(75, 100);
        verify(repository, times(2)).findAll(any(Pageable.class));
    }
}
