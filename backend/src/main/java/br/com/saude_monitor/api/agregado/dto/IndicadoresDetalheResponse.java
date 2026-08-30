package br.com.saude_monitor.api.agregado.dto;

import java.time.Instant;

/**
 * Resposta do endpoint dedicado {@code GET /api/v1/hospitais/{id}/indicadores} (§3.5).
 *
 * <p>Versão enriquecida dos indicadores públicos: além de nota média / tempo mediano /
 * N, expõe {@code nVisitas} e o período calculado ({@code periodo.inicio/fim}) para
 * transparência total (RN-19).</p>
 *
 * <p>Quando {@code nAvaliacoes < 5} (RN-15), {@code indicadoresDisponiveis = false} e os
 * campos de valor ficam {@code null}.</p>
 */
public record IndicadoresDetalheResponse(
        String hospitalId,
        boolean indicadoresDisponiveis,
        Double notaMedia,
        Integer nAvaliacoes,
        Integer tempoMedianoMinutos,
        Integer nVisitas,
        Periodo periodo,
        Instant atualizadoEm
) {

    /** Fábrica padrão quando não há agregado materializado ainda (nenhum feedback/visita). */
    public static IndicadoresDetalheResponse indisponivel(String hospitalId) {
        return new IndicadoresDetalheResponse(hospitalId, false, null, null, null, null, null, null);
    }

    /** Intervalo (inclusivo) do período de cálculo (RN-19). */
    public record Periodo(Instant inicio, Instant fim) {
    }
}
