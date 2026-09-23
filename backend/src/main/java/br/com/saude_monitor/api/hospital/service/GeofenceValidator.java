package br.com.saude_monitor.api.hospital.service;

import br.com.saude_monitor.api.config.exception.ValidacaoNegocioException;
import br.com.saude_monitor.api.hospital.dto.GeoJsonPolygonDto;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Valida as regras geométricas de um geofence (polígono GeoJSON), que não são
 * expressáveis via Bean Validation:
 *
 * <ul>
 *   <li>tipo deve ser {@code Polygon};</li>
 *   <li>anel externo fechado (primeiro e último vértice iguais);</li>
 *   <li>mínimo de 3 vértices distintos (≥ 4 posições no anel fechado);</li>
 *   <li>coordenadas dentro de {@code [-180,180]} × {@code [-90,90]};</li>
 *   <li>sem auto-interseção (exceto adjacências compartilhando vértice);</li>
 *   <li>área não degenerada.</li>
 * </ul>
 *
 * <p>Critérios de aceite E1-02 e F-01 (§3).</p>
 */
@Component
public class GeofenceValidator {

    private static final double EPS = 1e-12;

    /**
     * Valida o polígono. Lança {@link ValidacaoNegocioException} (400) na primeira
     * violação, com mensagem pt-BR descrevendo o problema.
     */
    public void validar(GeoJsonPolygonDto geofence) {
        if (geofence == null) {
            throw new ValidacaoNegocioException("O geofence é obrigatório.");
        }
        if (!"Polygon".equalsIgnoreCase(geofence.type())) {
            throw new ValidacaoNegocioException("O tipo do geofence deve ser 'Polygon'.");
        }
        if (geofence.coordinates() == null || geofence.coordinates().isEmpty()
            || geofence.coordinates().getFirst() == null) {
            throw new ValidacaoNegocioException("O geofence deve possuir ao menos um anel de coordenadas.");
        }
        // MVP: um único anel externo (sem buracos).
        if (geofence.coordinates().size() > 1) {
            throw new ValidacaoNegocioException("Geofence com buracos (multi-anel) não é suportado.");
        }

        List<List<Double>> anel = geofence.coordinates().getFirst();
        validarAnel(anel);
    }

    private void validarAnel(List<List<Double>> anel) {
        // Anel fechado exige ao menos 4 posições: 3 vértices distintos + fechamento.
        if (anel.size() < 4) {
            throw new ValidacaoNegocioException(
                    "O geofence deve ter ao menos 3 vértices distintos (anel fechado).");
        }

        double[] primeiro = posicao(anel.getFirst());
        double[] ultimo = posicao(anel.getLast());
        if (primeiro[0] != ultimo[0] || primeiro[1] != ultimo[1]) {
            throw new ValidacaoNegocioException(
                    "O anel do geofence deve ser fechado (primeiro e último vértice iguais).");
        }

        // Vértices distintos (despreza o ponto de fechamento).
        int n = anel.size() - 1;
        double[][] vertices = new double[n][2];
        for (int i = 0; i < n; i++) {
            vertices[i] = posicao(anel.get(i));
            validarLimites(vertices[i]);
        }

        if (areaAbsoluta(vertices) < EPS) {
            throw new ValidacaoNegocioException("O geofence possui área degenerada (colinear).");
        }

        if (possuiAutoIntersecao(vertices)) {
            throw new ValidacaoNegocioException("O geofence não pode possuir auto-interseção.");
        }
    }

    private double[] posicao(List<Double> p) {
        if (p == null || p.size() < 2) {
            throw new ValidacaoNegocioException("Cada posição do geofence deve ser [longitude, latitude].");
        }
        return new double[]{p.getFirst(), p.get(1)};
    }

    private void validarLimites(double[] p) {
        double lng = p[0];
        double lat = p[1];
        if (lng < -180 || lng > 180) {
            throw new ValidacaoNegocioException("Longitude fora do intervalo [-180, 180]: " + lng);
        }
        if (lat < -90 || lat > 90) {
            throw new ValidacaoNegocioException("Latitude fora do intervalo [-90, 90]: " + lat);
        }
    }

    /**
     * Área (em valor absoluto) pelo método do cadarço (shoelace), com as coordenadas
     * em graus. Usada apenas para rejeitar polígonos degenerados.
     */
    private double areaAbsoluta(double[][] v) {
        double area = 0;
        int n = v.length;
        for (int i = 0; i < n; i++) {
            int j = (i + 1) % n;
            area += v[i][0] * v[j][1] - v[j][0] * v[i][1];
        }
        return Math.abs(area) / 2.0;
    }

    /**
     * Detecta auto-interseção comparando todos os pares de arestas não adjacentes.
     * Complexidade O(n²), suficiente para geofences com dezenas de vértices.
     */
    private boolean possuiAutoIntersecao(double[][] v) {
        int n = v.length;
        for (int i = 0; i < n; i++) {
            for (int j = i + 1; j < n; j++) {
                if (saoAdjacentes(i, j, n)) {
                    continue;
                }
                if (segmentosSeInterceptam(v[i], v[(i + 1) % n], v[j], v[(j + 1) % n])) {
                    return true;
                }
            }
        }
        return false;
    }

    /** Duas arestas são adjacentes quando compartilham um vértice (inclui o fechamento do anel). */
    private boolean saoAdjacentes(int i, int j, int n) {
        return (j == i + 1) || (i == 0 && j == n - 1);
    }

    /** Teste de interseção de segmentos (orientação + colinearidade) — CLRS. */
    private boolean segmentosSeInterceptam(double[] a, double[] b, double[] c, double[] d) {
        double o1 = orientacao(a, b, c);
        double o2 = orientacao(a, b, d);
        double o3 = orientacao(c, d, a);
        double o4 = orientacao(c, d, b);

        if (o1 != o2 && o3 != o4) {
            return true;
        }
        if (o1 == 0 && sobreSegmento(a, c, b)) return true;
        if (o2 == 0 && sobreSegmento(a, d, b)) return true;
        if (o3 == 0 && sobreSegmento(c, a, d)) return true;
        if (o4 == 0 && sobreSegmento(c, b, d)) return true;
        return false;
    }

    private double orientacao(double[] a, double[] b, double[] c) {
        double val = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
        if (Math.abs(val) < EPS) return 0;
        return val > 0 ? 1 : -1;
    }

    private boolean sobreSegmento(double[] a, double[] p, double[] b) {
        return p[0] <= Math.max(a[0], b[0]) && p[0] >= Math.min(a[0], b[0])
                && p[1] <= Math.max(a[1], b[1]) && p[1] >= Math.min(a[1], b[1]);
    }
}
