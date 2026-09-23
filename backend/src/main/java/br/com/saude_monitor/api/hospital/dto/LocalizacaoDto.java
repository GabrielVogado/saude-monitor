package br.com.saude_monitor.api.hospital.dto;

/**
 * Ponto geográfico simples (centroide do geofence) exposto na listagem pública.
 *
 * <p>Existe para que {@code GET /api/v1/hospitais} não precise trafegar o polígono
 * completo do geofence: como o polígono é um círculo gerado por
 * {@link br.com.saude_monitor.api.hospital.service.GeofenceFactory#criarCirculo}
 * a partir de centro e raio, centro + raio reconstroem a mesma geometria no cliente
 * com ~60 bytes em vez de ~1,4 KB por hospital (E8-03).</p>
 */
public record LocalizacaoDto(double latitude, double longitude) {
}
