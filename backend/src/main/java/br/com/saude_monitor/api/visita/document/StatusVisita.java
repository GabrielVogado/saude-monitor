package br.com.saude_monitor.api.visita.document;

/**
 * Status do ciclo de vida de uma visita (Épico 02 — Detecção de Visitas).
 *
 * <p>Transições: {@code EM_ATENDIMENTO} → {@code SUSPEITA} (2h sem heartbeat, RN-23) →
 * volta a {@code EM_ATENDIMENTO} (heartbeat) ou {@code EXPIRADA} (24h sem heartbeat, RN-04).
 * {@code EM_ATENDIMENTO}/{@code SUSPEITA} → {@code FINALIZADA} (checkout normal, RN-03) ou
 * {@code GPS_INTERROMPIDO} (checkout sem sinal de GPS por 10min, RN-06/E2-05).</p>
 */
public enum StatusVisita {
    EM_ATENDIMENTO,
    SUSPEITA,
    FINALIZADA,
    EXPIRADA,
    GPS_INTERROMPIDO,

    /** Visita encerrada cuja janela de resposta de feedback (24h) expirou sem resposta (RN-09). */
    SEM_FEEDBACK
}
