package br.com.saude_monitor.api.visita.dto;

/**
 * Hospital candidato em caso de empate de geofences sobrepostos (E2-04/RN-05), para o app
 * perguntar em 1 toque "Você está em X ou Y?".
 */
public record CandidatoGeofence(
        String hospitalId,
        String nome,
        double distanciaMetros
) {
}
