package br.com.saude_monitor.api.agregado.service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Funções estatísticas puras usadas na agregação de indicadores (Épico 04).
 *
 * <p>Concentra as regras numéricas isoladas para permitir teste unitário direto,
 * sem dependência de MongoDB:</p>
 * <ul>
 *   <li>{@link #notaMedia(List)} — RN-14 (média aritmética das notas);</li>
 *   <li>{@link #tempoMedianoMinutos(List)} — RN-16 (mediana das durações);</li>
 *   <li>{@link #coberturaGpsConfiável(long, long)} — RN-17 (≥ 90% do período coberto).</li>
 * </ul>
 */
public final class EstatisticaService {

    private EstatisticaService() {
    }

    /**
     * Média aritmética das notas (RN-14). {@code null} quando a lista é vazia.
     * Notas fora do intervalo 1–5 são ignoradas (defensivo).
     */
    public static Double notaMedia(List<Integer> notas) {
        if (notas == null || notas.isEmpty()) {
            return null;
        }
        double soma = 0;
        int n = 0;
        for (Integer nota : notas) {
            if (nota != null && nota >= 1 && nota <= 5) {
                soma += nota;
                n++;
            }
        }
        if (n == 0) {
            return null;
        }
        return soma / n;
    }

    /**
     * Mediana das durações em minutos (RN-16). {@code null} quando a lista é vazia.
     * Survivor robusto a outliers (filas de 12h+ do SUS entram, RN-16/R-17).
     */
    public static Integer tempoMedianoMinutos(List<Integer> minutos) {
        List<Integer> ordenados = minutos.stream()
                .filter(java.util.Objects::nonNull)
                .sorted()
                .toList();
        if (ordenados.isEmpty()) {
            return null;
        }
        int meio = ordenados.size() / 2;
        if (ordenados.size() % 2 != 0) {
            return ordenados.get(meio);
        }
        int a = ordenados.get(meio - 1);
        int b = ordenados.get(meio);
        return (int) Math.round((a + b) / 2.0);
    }

    /**
     * Regra RN-17: a visita {@code GPS_INTERROMPIDO} entra na métrica de tempo apenas
     * se o tempo parcial for confiável, ou seja, se a cobertura de GPS cobriu
     * {@code percentualMinimo} (padrão 90%) do período entre entrada e saída.
     *
     * @param periodoTotal   duração total (entrada → saída)
     * @param periodoCoberto duração com cobertura confiável de posição
     */
    public static boolean coberturaGpsConfiável(Duration periodoTotal, Duration periodoCoberto,
                                                double percentualMinimo) {
        if (periodoTotal == null || periodoTotal.isZero() || periodoTotal.isNegative()) {
            return false;
        }
        double coberto = periodoCoberto == null ? 0 : periodoCoberto.toMillis();
        return coberto / periodoTotal.toMillis() >= percentualMinimo;
    }

    /**
     * Conveniência para {@link #coberturaGpsConfiável(Duration, Duration, double)} com o
     * percentual padrão de 90%. Tolerância para durações com arredondamento: até
     * {@code 0.9 - 0.000001} é rejeitado; {@code 0.9} em diante é aceito.
     */
    public static boolean coberturaGpsConfiável(Duration periodoTotal, Duration periodoCoberto) {
        return coberturaGpsConfiável(periodoTotal, periodoCoberto, 0.9);
    }

    /** Fração coberta (0..1) entre dois instantes, usada para diagnóstico. */
    public static double fracaoCoberta(Instant inicio, Instant fim, Instant ultimaPosicaoEm) {
        if (inicio == null || fim == null || !fim.isAfter(inicio)) {
            return 0.0;
        }
        long total = Duration.between(inicio, fim).toMillis();
        if (total <= 0) {
            return 0.0;
        }
        long coberto = 0;
        if (ultimaPosicaoEm != null && ultimaPosicaoEm.isAfter(inicio)) {
            Instant ref = ultimaPosicaoEm.isBefore(fim) ? ultimaPosicaoEm : fim;
            coberto = Duration.between(inicio, ref).toMillis();
        }
        return Math.min(1.0, (double) coberto / total);
    }
}
