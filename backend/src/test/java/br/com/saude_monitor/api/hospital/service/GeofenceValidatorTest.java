package br.com.saude_monitor.api.hospital.service;

import br.com.saude_monitor.api.config.exception.ValidacaoNegocioException;
import br.com.saude_monitor.api.hospital.dto.GeoJsonPolygonDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Testes unitários da validação geométrica do geofence (E1-02 / F-01).
 */
class GeofenceValidatorTest {

    private final GeofenceValidator validator = new GeofenceValidator();

    /** Triângulo válido e fechado (3 vértices + fechamento). */
    private GeoJsonPolygonDto triangulo() {
        return new GeoJsonPolygonDto("Polygon", List.of(
                List.of(List.of(0.0, 0.0), List.of(0.0, 1.0), List.of(1.0, 0.0), List.of(0.0, 0.0))
        ));
    }

    @Test
    void deveAceitarPoligonoValido() {
        assertDoesNotThrow(() -> validator.validar(triangulo()));
    }

    @Test
    void deveRejeitarTipoDiferenteDePolygon() {
        GeoJsonPolygonDto dto = new GeoJsonPolygonDto("Point", triangulo().coordinates());
        assertThrows(ValidacaoNegocioException.class, () -> validator.validar(dto));
    }

    @Test
    void deveRejeitarAnelAberto() {
        // Último vértice difere do primeiro.
        GeoJsonPolygonDto dto = new GeoJsonPolygonDto("Polygon", List.of(
                List.of(List.of(0.0, 0.0), List.of(0.0, 1.0), List.of(1.0, 0.0), List.of(1.0, 1.0))
        ));
        assertThrows(ValidacaoNegocioException.class, () -> validator.validar(dto));
    }

    @Test
    void deveRejeitarMenosDeTresVertices() {
        GeoJsonPolygonDto dto = new GeoJsonPolygonDto("Polygon", List.of(
                List.of(List.of(0.0, 0.0), List.of(0.0, 1.0), List.of(0.0, 0.0))
        ));
        assertThrows(ValidacaoNegocioException.class, () -> validator.validar(dto));
    }

    @Test
    void deveRejeitarLatitudeForaDosLimites() {
        GeoJsonPolygonDto dto = new GeoJsonPolygonDto("Polygon", List.of(
                List.of(List.of(0.0, 0.0), List.of(0.0, 200.0), List.of(1.0, 0.0), List.of(0.0, 0.0))
        ));
        assertThrows(ValidacaoNegocioException.class, () -> validator.validar(dto));
    }

    @Test
    void deveRejeitarAutoIntersecao() {
        // "Bowtie": arestas (0,0)-(1,1) e (1,0)-(0,1) se cruzam.
        GeoJsonPolygonDto dto = new GeoJsonPolygonDto("Polygon", List.of(
                List.of(List.of(0.0, 0.0), List.of(1.0, 1.0), List.of(1.0, 0.0),
                        List.of(0.0, 1.0), List.of(0.0, 0.0))
        ));
        assertThrows(ValidacaoNegocioException.class, () -> validator.validar(dto));
    }

    @Test
    void deveRejeitarAreaDegenerada() {
        // Todos os pontos colineares.
        GeoJsonPolygonDto dto = new GeoJsonPolygonDto("Polygon", List.of(
                List.of(List.of(0.0, 0.0), List.of(1.0, 0.0), List.of(2.0, 0.0), List.of(0.0, 0.0))
        ));
        assertThrows(ValidacaoNegocioException.class, () -> validator.validar(dto));
    }
}
