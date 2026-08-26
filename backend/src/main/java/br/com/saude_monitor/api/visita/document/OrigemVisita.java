package br.com.saude_monitor.api.visita.document;

/**
 * Origem do registro de uma visita (RN-05).
 */
public enum OrigemVisita {
    /** Detectada automaticamente pelo geofencing nativo do dispositivo (E2-01/E2-02). */
    GEOFENCE,
    /** Registrada manualmente pelo usuário, plano B sem GPS/permissão (E2-06). */
    MANUAL
}
