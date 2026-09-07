package br.com.saude_monitor.api.hospital.service;

import br.com.saude_monitor.api.hospital.dto.GeoJsonPolygonDto;
import org.junit.jupiter.api.Test;
import org.springframework.data.geo.Point;
import org.springframework.data.mongodb.core.geo.GeoJsonLineString;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.geo.GeoJsonPolygon;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Testes unitários do utilitário de geometria (conversão, centroide, círculo).
 */
class GeofenceFactoryTest {

    private final GeofenceFactory factory = new GeofenceFactory();

    @Test
    void deveConverterDtoParaPolygonEVoltar() {
        GeoJsonPolygonDto dto = new GeoJsonPolygonDto("Polygon", List.of(
                List.of(List.of(0.0, 0.0), List.of(0.0, 1.0), List.of(1.0, 0.0), List.of(0.0, 0.0))
        ));

        GeoJsonPolygon polygon = factory.toPolygon(dto);
        GeoJsonPolygonDto roundTrip = factory.toDto(polygon);

        assertEquals("Polygon", roundTrip.type());
        assertEquals(dto.coordinates(), roundTrip.coordinates());
    }

    @Test
    void deveCalcularCentroideDeUmQuadrado() {
        GeoJsonPolygonDto dto = new GeoJsonPolygonDto("Polygon", List.of(
                List.of(List.of(0.0, 0.0), List.of(0.0, 2.0), List.of(2.0, 2.0), List.of(2.0, 0.0), List.of(0.0, 0.0))
        ));

        GeoJsonPoint centroide = factory.calcularCentroide(factory.toPolygon(dto));

        assertNotNull(centroide);
        assertEquals(1.0, centroide.getX(), 1e-9);
        assertEquals(1.0, centroide.getY(), 1e-9);
    }

    @Test
    void deveCriarCirculoFechadoComLadosEsperados() {
        GeoJsonPolygon circulo = factory.criarCirculo(-15.78, -47.88, 150.0, GeofenceFactory.LADOS_CIRCULO);

        List<GeoJsonLineString> aneis = circulo.getCoordinates();
        assertEquals(1, aneis.size());

        List<Point> anel = aneis.get(0).getCoordinates();
        assertEquals(GeofenceFactory.LADOS_CIRCULO + 1, anel.size()); // fechado
        assertEquals(anel.get(0).getX(), anel.get(anel.size() - 1).getX(), 1e-9);
        assertEquals(anel.get(0).getY(), anel.get(anel.size() - 1).getY(), 1e-9);
    }

    // E8-03: a listagem publica passou a expor centro + raio no lugar do poligono.
    // O raio precisa ser recuperavel do poligono, senao o cliente nao reconstroi o circulo.
    @Test
    void deveRecuperarRaioDoCirculoGerado() {
        double raioOriginal = 150.0;
        GeoJsonPolygon circulo = factory.criarCirculo(-15.78, -47.88, raioOriginal, GeofenceFactory.LADOS_CIRCULO);
        GeoJsonPoint centroide = factory.calcularCentroide(circulo);

        Integer raio = factory.raioAproximadoMetros(circulo, centroide);

        assertNotNull(raio);
        // Tolerancia de 1 m: o centroide de um poligono de 32 lados nao coincide
        // exatamente com o centro do circulo circunscrito.
        assertEquals(raioOriginal, raio, 1.0);
    }

    @Test
    void deveRetornarRaioNuloQuandoNaoHaGeometria() {
        assertNull(factory.raioAproximadoMetros(null, new GeoJsonPoint(-47.88, -15.78)));
        assertNull(factory.raioAproximadoMetros(
                factory.criarCirculo(-15.78, -47.88, 150.0, GeofenceFactory.LADOS_CIRCULO), null));
    }

    // ------------------------------------------------------------------
    // ehCirculoRegular — salvaguarda da reconciliação de raio (BUG-08)
    // ------------------------------------------------------------------

    @Test
    void deveReconhecerCirculoGeradoPelaPropriaFabrica() {
        GeoJsonPolygon circulo = factory.criarCirculo(-15.9023, -48.0742, 150.0, GeofenceFactory.LADOS_CIRCULO);
        GeoJsonPoint centro = new GeoJsonPoint(-48.0742, -15.9023);

        assertTrue(factory.ehCirculoRegular(circulo, centro));
    }

    @Test
    void deveReconhecerCirculoEmQualquerLatitudeDoDf() {
        // A aproximação equiretangular distorce o círculo conforme a latitude; o extremo
        // norte e o extremo sul do DF continuam dentro da tolerância de 2%.
        for (double latitude : new double[] {-15.50, -15.90, -16.05}) {
            GeoJsonPolygon circulo = factory.criarCirculo(latitude, -47.9, 100.0, GeofenceFactory.LADOS_CIRCULO);
            GeoJsonPoint centro = new GeoJsonPoint(-47.9, latitude);

            assertTrue(factory.ehCirculoRegular(circulo, centro),
                    "círculo em " + latitude + " deveria ser reconhecido como regular");
        }
    }

    @Test
    void naoDeveReconhecerPoligonoDesenhadoAMao() {
        // Terreno retangular de ~200 m x 100 m: distância do centro varia demais para ser círculo.
        GeoJsonPolygonDto dto = new GeoJsonPolygonDto("Polygon", List.of(
                List.of(List.of(-48.0752, -15.9018), List.of(-48.0732, -15.9018),
                        List.of(-48.0732, -15.9027), List.of(-48.0752, -15.9027),
                        List.of(-48.0752, -15.9018))
        ));
        GeoJsonPolygon poligono = factory.toPolygon(dto);

        assertFalse(factory.ehCirculoRegular(poligono, factory.calcularCentroide(poligono)));
    }

    @Test
    void naoDeveReconhecerCirculoComPoucosVertices() {
        // Um octógono tem raio uniforme, mas 4 lados não saem de criarCirculo (32 lados).
        GeoJsonPolygon quadrado = factory.criarCirculo(-15.9, -48.0, 100.0, 4);

        assertFalse(factory.ehCirculoRegular(quadrado, new GeoJsonPoint(-48.0, -15.9)));
    }

    @Test
    void naoDeveReconhecerCirculoLisoDesenhadoPorFerramenta() {
        // Um círculo de 16 lados tem raio uniforme (dispersão ~0) e lados suficientes
        // para parecer círculo — mas 16 ≠ 32, então NÃO saiu de criarCirculo. É o tipo
        // de geometria que uma ferramenta de desenho produz ao traçar um círculo manual,
        // e deve ser preservado pela salvaguarda, não regravado no próximo boot.
        GeoJsonPolygon circuloDaFerramenta = factory.criarCirculo(-15.9, -48.0, 90.0, 16);

        assertFalse(factory.ehCirculoRegular(circuloDaFerramenta, new GeoJsonPoint(-48.0, -15.9)));
    }

    @Test
    void naoDeveReconhecerGeometriaAusenteOuDegenerada() {
        GeoJsonPoint centro = new GeoJsonPoint(-48.0, -15.9);
        GeoJsonPolygon degenerado = factory.criarCirculo(-15.9, -48.0, 0.0, GeofenceFactory.LADOS_CIRCULO);

        assertFalse(factory.ehCirculoRegular(null, centro));
        assertFalse(factory.ehCirculoRegular(factory.criarCirculo(-15.9, -48.0, 100.0, GeofenceFactory.LADOS_CIRCULO), null));
        assertFalse(factory.ehCirculoRegular(degenerado, centro));
    }

    @Test
    void raioAproximadoDeveAcompanharOCirculoRegravado() {
        // O caminho que a reconciliação percorre: mede o raio antigo, regrava, mede de novo.
        GeoJsonPoint centro = new GeoJsonPoint(-48.0742, -15.9023);
        GeoJsonPolygon antigo = factory.criarCirculo(centro.getY(), centro.getX(), 150.0, GeofenceFactory.LADOS_CIRCULO);
        assertEquals(150, factory.raioAproximadoMetros(antigo, centro));

        GeoJsonPolygon novo = factory.criarCirculo(centro.getY(), centro.getX(), 100.0, GeofenceFactory.LADOS_CIRCULO);
        assertEquals(100, factory.raioAproximadoMetros(novo, centro));
        assertTrue(factory.ehCirculoRegular(novo, centro));
    }
}
