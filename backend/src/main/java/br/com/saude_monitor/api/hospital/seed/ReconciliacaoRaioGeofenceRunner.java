package br.com.saude_monitor.api.hospital.seed;

import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.hospital.service.GeofenceFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.geo.GeoJsonPolygon;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Regrava, no startup, os geofences cujo raio ficou diferente do raio da categoria
 * declarado em {@code app.seed.raio-*} (BUG-08).
 *
 * <p><b>Por que existe:</b> o {@link SeedRunner} roda em {@code skip-if-not-empty} e só
 * semeia banco vazio. Sem este reconciliador, reduzir um raio no
 * {@code application.properties} não teria efeito nenhum sobre os 340 estabelecimentos
 * já gravados — o mapa e o {@code $geoIntersects} do check-in continuariam usando os
 * polígonos antigos, e a correção existiria apenas no código.</p>
 *
 * <p><b>O que ele não faz:</b> não toca em polígono que não seja um círculo regular
 * gerado por {@link GeofenceFactory#criarCirculo} (ver
 * {@link GeofenceFactory#ehCirculoRegular}). Um geofence desenhado à mão por um
 * administrador descreve o terreno real da unidade e vale mais que o círculo da
 * categoria: é preservado e apenas registrado no log. Também não move o centro — o
 * círculo novo é gerado em torno da mesma {@code localizacao}, então a única coisa que
 * muda é o raio.</p>
 *
 * <p><b>Idempotente:</b> na segunda execução todos os raios já batem e nada é gravado.
 * Roda depois do seed ({@code @Order}) para não recalcular o que acabou de nascer certo.</p>
 */
@Slf4j
@Component
@Order(ReconciliacaoRaioGeofenceRunner.ORDEM)
@ConditionalOnProperty(prefix = "app.geofence.reconciliacao", name = "enabled", havingValue = "true")
@RequiredArgsConstructor
public class ReconciliacaoRaioGeofenceRunner implements ApplicationRunner {

    /** Depois do seed ({@link SeedRunner#ORDEM}): reconcilia o que já existia, não o recém-semeado. */
    public static final int ORDEM = 20;

    /**
     * Diferença tolerada entre o raio medido e o raio da categoria, em metros. O raio medido
     * vem de {@link GeofenceFactory#raioAproximadoMetros}, que arredonda para inteiro; 1 m
     * evita que o arredondamento sozinho provoque uma regravação a cada boot.
     */
    private static final int TOLERANCIA_METROS = 1;

    /** Documentos por página — a coleção cabe em memória hoje (340), mas não se depende disso. */
    private static final int TAMANHO_PAGINA = 200;

    private final HospitalRepository hospitalRepository;
    private final GeofenceFactory geofenceFactory;
    private final SeedProperties properties;
    private final MongoTemplate mongoTemplate;

    @Override
    public void run(ApplicationArguments args) {
        int ajustados = 0;
        int preservados = 0;
        int semGeometria = 0;
        int total = 0;

        Pageable pagina = PageRequest.of(0, TAMANHO_PAGINA, Sort.by(Sort.Direction.ASC, "id"));
        Page<HospitalDocument> page;

        do {
            page = hospitalRepository.findAll(pagina);
            // Update parcial e atômico por _id (só `geofence`/`atualizadoEm`), em vez de
            // regravar o HospitalDocument inteiro: uma edição administrativa concorrente
            // (outros campos) feita entre este findAll e a escrita não é perdida.
            BulkOperations bulkOps = mongoTemplate.bulkOps(BulkOperations.BulkMode.UNORDERED, HospitalDocument.class);
            int naPagina = 0;

            for (HospitalDocument hospital : page.getContent()) {
                total++;
                GeoJsonPolygon geofence = hospital.getGeofence();
                GeoJsonPoint centro = hospital.getLocalizacao();
                if (geofence == null || centro == null || hospital.getCategoria() == null) {
                    semGeometria++;
                    continue;
                }

                Integer raioAtual = geofenceFactory.raioAproximadoMetros(geofence, centro);
                int raioAlvo = (int) Math.round(properties.raio(hospital.getCategoria()));
                if (raioAtual == null) {
                    semGeometria++;
                    continue;
                }
                if (Math.abs(raioAtual - raioAlvo) <= TOLERANCIA_METROS) {
                    continue; // já está no raio da categoria
                }
                if (!geofenceFactory.ehCirculoRegular(geofence, centro)) {
                    preservados++;
                    log.info("[Geofence] '{}' ({}) tem polígono próprio de ~{} m; "
                            + "raio da categoria é {} m. Preservado — reconciliação só regrava círculos gerados.",
                            hospital.getNome(), hospital.getId(), raioAtual, raioAlvo);
                    continue;
                }

                GeoJsonPolygon novoGeofence = geofenceFactory.criarCirculo(
                        centro.getY(), centro.getX(), raioAlvo, GeofenceFactory.LADOS_CIRCULO);
                bulkOps.updateOne(
                        Query.query(Criteria.where("id").is(hospital.getId())),
                        Update.update("geofence", novoGeofence).set("atualizadoEm", Instant.now()));
                naPagina++;
            }

            if (naPagina > 0) {
                bulkOps.execute();
                ajustados += naPagina;
            }

            pagina = pagina.next();
        } while (page.hasNext());

        if (ajustados == 0 && preservados == 0 && semGeometria == 0) {
            log.info("[Geofence] {} estabelecimento(s) verificados: todos já no raio da categoria.", total);
        } else {
            log.info("[Geofence] {} estabelecimento(s) verificados — {} com raio ajustado, "
                    + "{} com polígono próprio preservado, {} sem geometria utilizável.",
                    total, ajustados, preservados, semGeometria);
        }
    }
}
