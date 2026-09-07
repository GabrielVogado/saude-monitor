package br.com.saude_monitor.api.hospital.seed;

import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.dto.GeoJsonPolygonDto;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.hospital.service.GeofenceFactory;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.geo.GeoJsonPolygon;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;

/**
 * Testes da reconciliação de raio dos geofences já gravados (BUG-08).
 *
 * <p>Usa o {@link GeofenceFactory} de verdade — a geometria é o que está sob teste;
 * mockar a fábrica testaria apenas o encadeamento de chamadas.</p>
 */
class ReconciliacaoRaioGeofenceRunnerTest {

    private static final double LAT = -15.9023;
    private static final double LON = -48.0742;

    private final HospitalRepository repository = mock(HospitalRepository.class);
    private final GeofenceFactory factory = new GeofenceFactory();

    /** Raios de destino: HOSPITAL 150 · UPA/POLICLINICA/CAPS/CENTRO/OUTRO 100 · UBS 75. */
    private final SeedProperties properties = new SeedProperties(
            true, "data/", "UTF-8", "skip-if-not-empty", "LOTE", 0.05,
            150.0, 100.0, 75.0, 100.0, 100.0, 100.0, 100.0);

    private final ReconciliacaoRaioGeofenceRunner runner =
            new ReconciliacaoRaioGeofenceRunner(repository, factory, properties);

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

    @SuppressWarnings("unchecked")
    private List<HospitalDocument>[] capturarSalvos() {
        List<HospitalDocument>[] caixa = new List[1];
        doAnswer(invocacao -> {
            caixa[0] = invocacao.getArgument(0);
            return caixa[0];
        }).when(repository).saveAll(anyList());
        return caixa;
    }

    @Test
    void deveEncolherOCirculoAntigoAteORaioDaCategoria() {
        comPagina(List.of(hospital(CategoriaEstabelecimento.UBS, 100.0)));
        List<HospitalDocument>[] salvos = capturarSalvos();

        runner.run(null);

        assertThat(salvos[0]).hasSize(1);
        HospitalDocument ajustado = salvos[0].getFirst();
        GeoJsonPoint centro = ajustado.getLocalizacao();
        assertThat(factory.raioAproximadoMetros(ajustado.getGeofence(), centro)).isEqualTo(75);
        // O centro não se move: só o raio muda.
        assertThat(centro.getX()).isEqualTo(LON);
        assertThat(centro.getY()).isEqualTo(LAT);
        assertThat(ajustado.getAtualizadoEm()).isNotNull();
    }

    @Test
    void deveAplicarORaioDeCadaCategoriaNaMesmaPassada() {
        comPagina(List.of(
                hospital(CategoriaEstabelecimento.HOSPITAL, 200.0),
                hospital(CategoriaEstabelecimento.UPA, 150.0),
                hospital(CategoriaEstabelecimento.UBS, 100.0)));
        List<HospitalDocument>[] salvos = capturarSalvos();

        runner.run(null);

        assertThat(salvos[0]).hasSize(3);
        assertThat(salvos[0])
                .extracting(h -> factory.raioAproximadoMetros(h.getGeofence(), h.getLocalizacao()))
                .containsExactly(150, 100, 75);
    }

    @Test
    void naoDeveGravarQuandoOsRaiosJaEstaoCertos() {
        comPagina(List.of(
                hospital(CategoriaEstabelecimento.HOSPITAL, 150.0),
                hospital(CategoriaEstabelecimento.UBS, 75.0)));

        runner.run(null);

        verify(repository, never()).saveAll(anyList());
    }

    @Test
    void deveSerIdempotenteNaSegundaExecucao() {
        HospitalDocument ubs = hospital(CategoriaEstabelecimento.UBS, 100.0);
        comPagina(List.of(ubs));
        capturarSalvos();

        runner.run(null); // primeira passada: encolhe de 100 para 75 no próprio documento
        runner.run(null); // segunda passada: nada a fazer

        verify(repository).saveAll(anyList()); // exatamente uma gravação nas duas execuções
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

        verify(repository, never()).saveAll(anyList());
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

        verify(repository, never()).saveAll(anyList());
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
        List<HospitalDocument>[] salvos = capturarSalvos();

        runner.run(null);

        // A segunda página também foi ajustada: a UPA só aparece nela.
        assertThat(salvos[0]).hasSize(1);
        assertThat(factory.raioAproximadoMetros(
                salvos[0].getFirst().getGeofence(), salvos[0].getFirst().getLocalizacao()))
                .isEqualTo(100);
        verify(repository, org.mockito.Mockito.times(2)).findAll(any(Pageable.class));
    }
}
