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
}
