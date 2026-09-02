package br.com.saude_monitor.api.hospital.service;

import br.com.saude_monitor.api.hospital.dto.GeoJsonPolygonDto;
import org.springframework.data.geo.Point;
import org.springframework.data.mongodb.core.geo.GeoJsonLineString;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.geo.GeoJsonPolygon;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Utilitário de geometria GeoJSON para o domínio de hospitais:
 *
 * <ul>
 *   <li>conversão {@code GeoJsonPolygonDto} ⇄ {@code GeoJsonPolygon} (Spring Data);</li>
 *   <li>cálculo do centroide (método do cadarço) para o campo {@code localizacao};</li>
 *   <li>geração de geofence circular a partir de um ponto (para importação CNES).</li>
 * </ul>
 *
 * <p>No modelo do Spring Data MongoDB 4.x, {@code GeoJsonPolygon.getCoordinates()} retorna
 * {@code List<GeoJsonLineString>} (um anel por linha), e cada {@code GeoJsonLineString}
 * expõe {@code List<Point>}. As coordenadas seguem a ordem GeoJSON {@code [longitude, latitude]}.</p>
 */
@Component
public class GeofenceFactory {

    /** Número padrão de lados do polígono que aproxima o círculo do geofence. */
    public static final int LADOS_CIRCULO = 32;

    private static final double METROS_POR_GRAU_LAT = 111_320.0;
    private static final double EPS = 1e-12;

    /**
     * Converte o DTO em {@link GeoJsonPolygon}, usando o anel externo informado.
     */
    public GeoJsonPolygon toPolygon(GeoJsonPolygonDto dto) {
        List<List<Double>> anel = dto.coordinates().getFirst();
        List<Point> pontos = new ArrayList<>(anel.size());
        for (List<Double> posicao : anel) {
            pontos.add(new Point(posicao.getFirst(), posicao.get(1)));
        }
        return new GeoJsonPolygon(pontos);
    }

    /**
     * Converte um {@link GeoJsonPolygon} de volta para o DTO de resposta.
     */
    public GeoJsonPolygonDto toDto(GeoJsonPolygon polygon) {
        List<GeoJsonLineString> aneis = polygon.getCoordinates();
        List<List<List<Double>>> coordinates = new ArrayList<>(aneis.size());
        for (GeoJsonLineString anel : aneis) {
            List<Point> pontos = anel.getCoordinates();
            List<List<Double>> anelOut = new ArrayList<>(pontos.size());
            for (Point p : pontos) {
                anelOut.add(List.of(p.getX(), p.getY()));
            }
            coordinates.add(anelOut);
        }
        return new GeoJsonPolygonDto("Polygon", coordinates);
    }

    /**
     * Calcula o centroide do anel externo do polígono pelo método do cadarço
     * (centroide ponderado pela área). Em polígonos degenerados, retorna a média
     * aritmética dos vértices.
     */
    public GeoJsonPoint calcularCentroide(GeoJsonPolygon polygon) {
        List<Point> anel = polygon.getCoordinates().getFirst().getCoordinates();
        int n = anel.size();
        if (n == 0) {
            return null;
        }
        // Despreza o ponto de fechamento repetido.
        List<Point> vertices = anel.getFirst().equals(anel.getLast()) ? anel.subList(0, n - 1) : anel;
        int m = vertices.size();

        double area = 0;
        double cx = 0;
        double cy = 0;
        for (int i = 0; i < m; i++) {
            Point a = vertices.get(i);
            Point b = vertices.get((i + 1) % m);
            double cross = a.getX() * b.getY() - b.getX() * a.getY();
            area += cross;
            cx += (a.getX() + b.getX()) * cross;
            cy += (a.getY() + b.getY()) * cross;
        }
        area /= 2.0;

        if (Math.abs(area) > EPS) {
            return new GeoJsonPoint(cx / (6.0 * area), cy / (6.0 * area));
        }
        // Fallback: média dos vértices.
        double sx = 0;
        double sy = 0;
        for (Point v : vertices) {
            sx += v.getX();
            sy += v.getY();
        }
        return new GeoJsonPoint(sx / m, sy / m);
    }

    /**
     * Gera um geofence circular (polígono regular de {@code lados} lados) em torno de
     * um ponto, aproximando um buffer de raio {@code raioMetros}. Usa a aproximação
     * equiretangular, adequada para a escala de geofence (100–150 m) e às latitudes
     * do DF.
     */
    public GeoJsonPolygon criarCirculo(double latitude, double longitude, double raioMetros, int lados) {
        double deltaLat = raioMetros / METROS_POR_GRAU_LAT;
        double deltaLng = raioMetros / (METROS_POR_GRAU_LAT * Math.cos(Math.toRadians(latitude)));

        List<Point> pontos = new ArrayList<>(lados + 1);
        for (int i = 0; i < lados; i++) {
            double angulo = 2 * Math.PI * i / lados;
            double lat = latitude + deltaLat * Math.cos(angulo);
            double lng = longitude + deltaLng * Math.sin(angulo);
            pontos.add(new Point(lng, lat));
        }
        // Fecha o anel.
        pontos.add(pontos.getFirst());
        return new GeoJsonPolygon(pontos);
    }

    /**
     * Operação inversa de {@link #criarCirculo}: estima o raio, em metros, do círculo
     * que originou o polígono. Usa a mesma aproximação equiretangular e toma a maior
     * distância entre o centroide e os vértices — para os geofences gerados pelo
     * produto (círculos regulares) todas as distâncias são iguais; o máximo apenas
     * torna o resultado estável caso um polígono venha de importação externa.
     *
     * <p>Usado para expor {@code raioMetros} na listagem pública sem trafegar o
     * polígono inteiro (E8-03).</p>
     *
     * @return o raio arredondado em metros, ou {@code null} se não for calculável.
     */
    public Integer raioAproximadoMetros(GeoJsonPolygon polygon, GeoJsonPoint centroide) {
        if (polygon == null || centroide == null || polygon.getCoordinates().isEmpty()) {
            return null;
        }
        List<Point> vertices = polygon.getCoordinates().getFirst().getCoordinates();
        if (vertices.isEmpty()) {
            return null;
        }
        double cosLat = Math.cos(Math.toRadians(centroide.getY()));
        double maior = 0.0;
        for (Point v : vertices) {
            double dLat = (v.getY() - centroide.getY()) * METROS_POR_GRAU_LAT;
            double dLng = (v.getX() - centroide.getX()) * METROS_POR_GRAU_LAT * cosLat;
            maior = Math.max(maior, Math.hypot(dLat, dLng));
        }
        return maior < EPS ? null : (int) Math.round(maior);
    }
}
