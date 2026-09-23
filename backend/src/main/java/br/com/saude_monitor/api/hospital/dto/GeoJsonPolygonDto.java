package br.com.saude_monitor.api.hospital.dto;

import java.util.List;

/**
 * Representação de polígono GeoJSON (RFC 7946) usada no payload da API.
 *
 * <p>Estrutura: {@code coordinates} é uma lista de anéis; cada anel é uma lista de
 * posições; cada posição é {@code [longitude, latitude]} (ordem GeoJSON). Para o
 * geofence do MVP, admite-se um único anel externo (sem buracos).</p>
 *
 * <p>A validação geométrica (anel fechado, vértices mínimos, ausência de
 * auto-interseção e limites de coordenadas) é realizada por
 * {@code GeofenceValidator} na camada de serviço, pois não é expressável via
 * Bean Validation.</p>
 */
public record GeoJsonPolygonDto(
        String type,
        List<List<List<Double>>> coordinates
) {
}
