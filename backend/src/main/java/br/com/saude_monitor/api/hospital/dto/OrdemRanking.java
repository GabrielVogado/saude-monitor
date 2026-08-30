package br.com.saude_monitor.api.hospital.dto;

/**
 * Ordenação do ranking público de hospitais (E4-05).
 *
 * <p>Critério de aceite: ranking ordenável por nota média ({@code NOTA}) e por
 * tempo médio de atendimento ({@code TEMPO}). A ordenação por tempo é crescente
 * (menor tempo = melhor); por nota é decrescente (maior nota = melhor).</p>
 */
public enum OrdemRanking {
    /** Ordena por nota média (maior primeiro). */
    NOTA,
    /** Ordena por tempo mediano de atendimento (menor primeiro). */
    TEMPO
}
