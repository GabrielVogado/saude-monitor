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
}
