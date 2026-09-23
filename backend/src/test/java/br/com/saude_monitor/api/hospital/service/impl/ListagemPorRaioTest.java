package br.com.saude_monitor.api.hospital.service.impl;

import br.com.saude_monitor.api.agregado.service.AgregadoService;
import br.com.saude_monitor.api.config.security.AutenticacaoHelper;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import br.com.saude_monitor.api.hospital.dto.HospitalResumoResponse;
import br.com.saude_monitor.api.hospital.dto.IndicadoresResponse;
import br.com.saude_monitor.api.hospital.dto.PageResponse;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.hospital.repository.SugestaoHospitalRepository;
import br.com.saude_monitor.api.hospital.service.GeofenceFactory;
import br.com.saude_monitor.api.hospital.service.GeofenceValidator;
import br.com.saude_monitor.api.hospital.service.HospitalService;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.query.NearQuery;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Listagem por raio (F-07) — a consulta que o serviço monta.
 *
 * <p>Complementa {@code CriacaoDeIndicesTest}, que mede o resultado contra um MongoDB
 * real: aqui o alvo é a <b>consulta em si</b>, sem Docker, para que uma regressão no
 * operador, no campo, na unidade de distância ou na ordem das coordenadas apareça em
 * segundos e não só no deploy.</p>
 *
 * <p>Cada asserção corresponde a um modo de falha já visto ou vizinho dele:
 * {@code $geoNear} não escolhe índice quando a coleção tem dois (BUG-07);
 * {@code $maxDistance} sobre GeoJSON é em <b>metros</b>, e passar quilômetros
 * encolheria o raio mil vezes; e GeoJSON guarda {@code [longitude, latitude]}, ordem
 * inversa da que o app exibe.</p>
 */
class ListagemPorRaioTest {

    private final HospitalRepository hospitalRepository = mock(HospitalRepository.class);
    private final SugestaoHospitalRepository sugestaoRepository = mock(SugestaoHospitalRepository.class);
    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final GeofenceValidator geofenceValidator = mock(GeofenceValidator.class);
    private final GeofenceFactory geofenceFactory = mock(GeofenceFactory.class);
    private final AutenticacaoHelper autenticacaoHelper = mock(AutenticacaoHelper.class);
    private final AgregadoService agregadoService = mock(AgregadoService.class);

    private final HospitalService service =
            new HospitalServiceImpl(hospitalRepository, sugestaoRepository, mongoTemplate,
                    geofenceValidator, geofenceFactory, autenticacaoHelper, agregadoService);

    /** Coordenada do relato do PO (Recanto das Emas, DF). */
    private static final double LAT = -15.924781;
    private static final double LON = -48.053610;

    @BeforeEach
    void setup() {
        when(mongoTemplate.find(any(Query.class), eq(HospitalDocument.class)))
                .thenReturn(List.of(
                        hospital("h1", "Hospital Regional do Gama", TipoEstabelecimento.PUBLICO),
                        hospital("h2", "UPA do Recanto", TipoEstabelecimento.PUBLICO),
                        hospital("h3", "Clinica Particular", TipoEstabelecimento.PRIVADO)));
        when(agregadoService.mapaIndicadores(anyCollection()))
                .thenAnswer(inv -> ((java.util.Collection<?>) inv.getArgument(0)).stream()
                        .map(id -> IndicadoresResponse.indisponivel())
                        .toList());
    }

    private HospitalDocument hospital(String id, String nome, TipoEstabelecimento tipo) {
        return HospitalDocument.builder().id(id).nome(nome).tipo(tipo).ativo(true).build();
    }

    /** Roda a listagem e devolve o critério bruto que foi parar no MongoTemplate. */
    private Document criterioDe(Double raioKm, TipoEstabelecimento tipo) {
        service.listar(LAT, LON, raioKm, tipo, null, 0, 20);
        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).find(captor.capture(), eq(HospitalDocument.class));
        return captor.getValue().getQueryObject();
    }

    /**
     * A cláusula geoespacial do critério. Forma gerada pelo Spring Data quando o ponto
     * é GeoJSON:
     * {@code localizacao: { $nearSphere: { $geometry: <Point>, $maxDistance: <metros> } }}.
     */
    private Document clausulaGeo(Document criterio) {
        assertThat(criterio.get("localizacao"))
                .as("a consulta precisa nomear o campo geoespacial: $geoNear escolhe o indice "
                        + "sozinho e a colecao tem dois (BUG-07)")
                .isInstanceOf(Document.class);
        Document campo = (Document) criterio.get("localizacao");
        assertThat(campo).containsKey("$nearSphere");
        return (Document) campo.get("$nearSphere");
    }

    private double maxDistanceDe(Document geo) {
        return ((Number) geo.get("$maxDistance")).doubleValue();
    }

    @Test
    @DisplayName("usa $nearSphere sobre o campo localizacao, e nunca $geoNear")
    void usaNearSphereComCampoExplicito() {
        Document geo = clausulaGeo(criterioDe(5.0, null));

        assertThat(geo).containsKey("$geometry");
        verify(mongoTemplate, never()).geoNear(any(NearQuery.class), eq(HospitalDocument.class));
    }

    @Test
    @DisplayName("$maxDistance vai em metros — 5 km viram 5000")
    void converteQuilometrosParaMetros() {
        Document geo = clausulaGeo(criterioDe(5.0, null));

        assertThat(maxDistanceDe(geo)).isEqualTo(5_000.0);
    }

    @Test
    @DisplayName("sem raio informado, o padrão de 10 km é aplicado")
    void aplicaRaioPadraoQuandoOmitido() {
        Document geo = clausulaGeo(criterioDe(null, null));

        assertThat(maxDistanceDe(geo)).isEqualTo(10_000.0);
    }

    @Test
    @DisplayName("o ponto vai em ordem GeoJSON: [longitude, latitude]")
    void respeitaAOrdemGeoJson() {
        Document geo = clausulaGeo(criterioDe(5.0, null));

        GeoJsonPoint ponto = (GeoJsonPoint) geo.get("$geometry");
        // GeoJSON: X = longitude, Y = latitude. Trocar os dois joga esta consulta
        // do Distrito Federal para o meio do Atlântico.
        assertThat(ponto.getX()).isEqualTo(LON);
        assertThat(ponto.getY()).isEqualTo(LAT);
    }

    @Test
    @DisplayName("o recorte geográfico não substitui os filtros que já existiam")
    void mantemFiltrosDeAtivoETipo() {
        Document criterio = criterioDe(5.0, TipoEstabelecimento.PUBLICO);

        assertThat(criterio.get("ativo")).isEqualTo(true);
        assertThat(criterio.get("tipo")).isEqualTo(TipoEstabelecimento.PUBLICO);
        assertThat(clausulaGeo(criterio)).containsKey("$geometry");
    }

    @Test
    @DisplayName("a busca por nome continua valendo junto com o raio")
    void combinaBuscaTextualComRaio() {
        PageResponse<HospitalResumoResponse> pagina =
                service.listar(LAT, LON, 5.0, null, "recanto", 0, 20);

        assertThat(pagina.content()).extracting(HospitalResumoResponse::nome)
                .containsExactly("UPA do Recanto");
        assertThat(pagina.totalElements()).isEqualTo(1);
    }

    @Test
    @DisplayName("a paginação do resultado por raio continua valendo")
    void paginaOResultadoDoRaio() {
        PageResponse<HospitalResumoResponse> primeira = service.listar(LAT, LON, 5.0, null, null, 0, 2);
        PageResponse<HospitalResumoResponse> segunda = service.listar(LAT, LON, 5.0, null, null, 1, 2);

        assertThat(primeira.content()).hasSize(2);
        assertThat(segunda.content()).hasSize(1);
        // O total é o do recorte inteiro, não o da página.
        assertThat(primeira.totalElements()).isEqualTo(3);
    }

    @Test
    @DisplayName("sem coordenada, nenhuma cláusula geoespacial entra na consulta")
    void semCoordenadaNaoUsaConsultaGeoespacial() {
        service.listar(null, null, 5.0, null, null, 0, 20);

        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).find(captor.capture(), eq(HospitalDocument.class));
        assertThat(captor.getValue().getQueryObject()).doesNotContainKey("localizacao");
    }
}
