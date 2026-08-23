package br.com.saude_monitor.api.hospital.dto;

import java.time.Instant;

/**
 * Indicadores públicos do hospital (placeholder do Épico 01).
 *
 * <p>Os valores reais (nota média, tempo mediano, N) são calculados no Épico 04
 * (agregados). Até lá, a API retorna {@code indicadoresDisponiveis = false} para
 * manter o contrato estável.</p>
 */
public record IndicadoresResponse(
        boolean indicadoresDisponiveis,
        Double notaMedia,
        Integer nAvaliacoes,
        Integer tempoMedianoMinutos,
        Instant atualizadoEm
) {

    /** Fábrica padrão enquanto os agregados (Épico 04) não estão disponíveis. */
    public static IndicadoresResponse indisponivel() {
        return new IndicadoresResponse(false, null, null, null, null);
    }
}
