package br.com.saude_monitor.api.visita.service;

import br.com.saude_monitor.api.visita.dto.CandidatoGeofence;

import java.util.List;

/**
 * Empate de geofences sobrepostos no check-in (E2-04/RN-05): o ponto está dentro de mais de
 * um geofence e a diferença de distância ao centroide é desprezível (≤ 10m). A visita NÃO é
 * criada; a API responde 409 com os candidatos para o app perguntar em 1 toque.
 *
 * <p>Os candidatos são guardados numa cópia imutável (e serializável), como exige uma
 * exceção {@link java.io.Serializable}.</p>
 */
public class ConflitoGeofenceException extends RuntimeException {

    private final List<CandidatoGeofence> candidatos;

    public ConflitoGeofenceException(String message, List<CandidatoGeofence> candidatos) {
        super(message);
        this.candidatos = candidatos == null ? List.of() : List.copyOf(candidatos);
    }

    public List<CandidatoGeofence> getCandidatos() {
        return candidatos;
    }
}
