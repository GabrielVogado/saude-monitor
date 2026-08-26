package br.com.saude_monitor.api.visita.dto;

import java.time.Instant;
import java.util.List;

/**
 * Resposta de conflito de geofences sobrepostos (HTTP 409, E2-04/RN-05): quando o ponto do
 * check-in está dentro de mais de um geofence e a diferença de distância ao centroide é
 * desprezível (empate ≤ 10m), a API não cria a visita e devolve os candidatos para o app
 * perguntar em 1 toque.
 */
public record ConflitoGeofenceResponse(
        Instant timestamp,
        int status,
        String code,
        String message,
        List<CandidatoGeofence> candidatos,
        String traceId
) {
}
