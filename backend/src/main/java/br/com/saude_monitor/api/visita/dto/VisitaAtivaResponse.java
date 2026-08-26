package br.com.saude_monitor.api.visita.dto;

/** Envelope de {@code GET /api/v1/visitas/ativas} — {@code visita} é {@code null} quando não há visita ativa (E2-07). */
public record VisitaAtivaResponse(
        VisitaResponse visita
) {
}
