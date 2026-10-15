package br.com.saude_monitor.api.regiao.service;

import br.com.saude_monitor.api.regiao.TipoCamada;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.LinearRing;
import org.locationtech.jts.geom.MultiPolygon;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.Polygon;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * Resolve a Região Administrativa (RA) que contém um ponto (hospital), a partir do
 * GeoJSON já carregado por {@link RegiaoService} (camada {@code regiao-administrativa}).
 *
 * <p><b>Por que existe (E7-03):</b> o hospital não tem "região" como atributo próprio —
 * só coordenadas. A camada de RAs é uma {@code FeatureCollection} pública de polígonos,
 * cada um com {@code properties.nome}; "estar numa região" é geometricamente "o ponto do
 * hospital cai dentro de qual polígono" — um teste point-in-polygon, não uma igualdade.</p>
 *
 * <p><b>Por que JTS e não consulta MongoDB:</b> {@link RegiaoService} decidiu (ver seu
 * Javadoc) manter as camadas fora do banco — sem coleção, sem índice {@code 2dsphere}
 * para elas. Persistir os polígonos só para este teste reintroduziria exatamente o custo
 * que aquela decisão evitou. O volume (uma dezena de polígonos, ~340 hospitais, recalculado
 * só na escrita/reconciliação, nunca por requisição pública) não justifica Mongo geoespacial;
 * a checagem em memória com JTS é imediata.</p>
 *
 * <p><b>Cobertura de borda:</b> usa {@link Geometry#covers(Geometry)} (não {@code contains}),
 * que inclui pontos exatamente sobre a fronteira do polígono — evita descartar um hospital
 * cujo centroide caia sobre a linha divisória entre duas RAs.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RegiaoAdministrativaResolver {

    private static final String PROPRIEDADE_NOME = "nome";

    private final RegiaoService regiaoService;
    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);
    private final ObjectMapper objectMapper = new ObjectMapper();

    private List<RegiaoPoligono> regioes = List.of();

    @PostConstruct
    void carregar() {
        String geojson = regiaoService.buscar(TipoCamada.REGIAO_ADMINISTRATIVA);
        regioes = Collections.unmodifiableList(parsear(geojson));
        log.info("[RegiaoAdministrativa] {} polígono(s) de Região Administrativa carregados.", regioes.size());
    }

    /**
     * Nome da RA cujo polígono contém {@code (longitude, latitude)}, ou vazio se o ponto
     * não cair em nenhuma (coordenada fora do território mapeado, ou camada sem dado).
     */
    public Optional<String> resolver(double longitude, double latitude) {
        Point ponto = geometryFactory.createPoint(new Coordinate(longitude, latitude));
        for (RegiaoPoligono regiao : regioes) {
            if (regiao.geometria().covers(ponto)) {
                return Optional.of(regiao.nome());
            }
        }
        return Optional.empty();
    }

    /** Nomes distintos das RAs carregadas, para popular um seletor no cliente. */
    public List<String> nomesDisponiveis() {
        return regioes.stream().map(RegiaoPoligono::nome).sorted().toList();
    }

    private List<RegiaoPoligono> parsear(String geojson) {
        List<RegiaoPoligono> resultado = new ArrayList<>();
        try {
            JsonNode raiz = objectMapper.readTree(geojson);
            for (JsonNode feature : raiz.path("features")) {
                String nome = feature.path("properties").path(PROPRIEDADE_NOME).asText(null);
                Geometry geometria = paraGeometria(feature.path("geometry"));
                if (nome == null || geometria == null) {
                    log.warn("[RegiaoAdministrativa] feature sem '{}' ou geometria válida — ignorada.",
                            PROPRIEDADE_NOME);
                    continue;
                }
                resultado.add(new RegiaoPoligono(nome, geometria));
            }
        } catch (Exception e) {
            // Falha aqui não pode derrubar a subida da aplicação (a camada continua servida
            // como está pelo RegiaoController); o filtro de região fica indisponível.
            log.error("[RegiaoAdministrativa] falha ao interpretar o GeoJSON da camada — "
                    + "o filtro por região ficará sempre vazio.", e);
        }
        return resultado;
    }

    private Geometry paraGeometria(JsonNode geometria) {
        String tipo = geometria.path("type").asText("");
        JsonNode coordenadas = geometria.path("coordinates");
        return switch (tipo) {
            case "Polygon" -> paraPolygon(coordenadas);
            case "MultiPolygon" -> paraMultiPolygon(coordenadas);
            default -> null;
        };
    }

    /** {@code coordinates} de um Polygon: array de anéis — [0] externo, [1..] buracos. */
    private Polygon paraPolygon(JsonNode aneis) {
        if (aneis.isEmpty()) {
            return null;
        }
        LinearRing externo = paraAnel(aneis.get(0));
        List<LinearRing> buracos = new ArrayList<>();
        for (int i = 1; i < aneis.size(); i++) {
            buracos.add(paraAnel(aneis.get(i)));
        }
        return geometryFactory.createPolygon(externo, buracos.toArray(new LinearRing[0]));
    }

    /** {@code coordinates} de um MultiPolygon: array de Polygons (cada um, array de anéis). */
    private MultiPolygon paraMultiPolygon(JsonNode poligonos) {
        List<Polygon> partes = new ArrayList<>();
        for (JsonNode aneisDoPoligono : poligonos) {
            Polygon poligono = paraPolygon(aneisDoPoligono);
            if (poligono != null) {
                partes.add(poligono);
            }
        }
        return geometryFactory.createMultiPolygon(partes.toArray(new Polygon[0]));
    }

    private LinearRing paraAnel(JsonNode anel) {
        Coordinate[] coordenadas = new Coordinate[anel.size()];
        for (int i = 0; i < anel.size(); i++) {
            JsonNode par = anel.get(i);
            coordenadas[i] = new Coordinate(par.get(0).asDouble(), par.get(1).asDouble());
        }
        return geometryFactory.createLinearRing(coordenadas);
    }

    private record RegiaoPoligono(String nome, Geometry geometria) {
    }
}
