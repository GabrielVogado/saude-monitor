package br.com.saude_monitor.api.config;

import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import br.com.saude_monitor.api.hospital.dto.HospitalResumoResponse;
import br.com.saude_monitor.api.hospital.dto.PageResponse;
import br.com.saude_monitor.api.hospital.service.HospitalService;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.geo.GeoJsonPolygon;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.geo.Point;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.Map;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * BUG-07 — a listagem por raio (F-07) devolvia HTTP 500 em produção.
 *
 * <p>Duas causas encadeadas, e cada teste aqui cobre uma:</p>
 *
 * <ol>
 *   <li>O prefixo da propriedade de criação de índices estava errado
 *       ({@code spring.mongodb.auto-index-creation} em vez de
 *       {@code spring.data.mongodb.auto-index-creation}). Propriedade desconhecida não
 *       derruba a aplicação: a chave era ignorada em silêncio e <b>nenhum</b> índice
 *       declarado existia no banco — nem os 2dsphere, nem os únicos, nem o TTL.</li>
 *   <li>Com os índices criados, o estágio {@code $geoNear} passou a falhar por motivo
 *       oposto: ele escolhe sozinho o índice geoespacial e {@code hospitais} tem dois
 *       ({@code geofence_2dsphere} e {@code localizacao_2dsphere}) — <i>"There is more
 *       than one 2d index ... unsure which to use"</i>. A consulta passou a usar
 *       {@code $nearSphere} com o campo explícito.</li>
 * </ol>
 *
 * <p>Os dois testes rodam contra um MongoDB real (Testcontainers) e medem o estado do
 * banco, e não a intenção do código.</p>
 */
@Testcontainers
@SpringBootTest
class CriacaoDeIndicesTest {

    @Container
    static final MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", mongo::getReplicaSetUrl);
    }

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private HospitalService hospitalService;

    /** Ponto de referência: o mesmo GPS do relato do PO (Recanto das Emas, DF). */
    private static final double LAT = -15.924781;
    private static final double LON = -48.053610;

    @BeforeEach
    void limparColecao() {
        mongoTemplate.remove(new org.springframework.data.mongodb.core.query.Query(),
                HospitalDocument.class);
    }

    @Test
    @DisplayName("os índices declarados em HospitalDocument existem no banco")
    void criaIndicesDeclarados() {
        List<String> nomes = mongoTemplate.indexOps(HospitalDocument.class)
                .getIndexInfo().stream()
                .map(IndexInfo::getName)
                .toList();

        assertThat(nomes).contains(
                "localizacao_2dsphere",
                "geofence_2dsphere",
                "idx_ativo_tipo",
                "cnpj",
                "codigoCnes",
                "importKey");
    }

    @Test
    @DisplayName("os índices geoespaciais são 2dsphere, e não 2d legado")
    void indicesGeoSao2dsphere() {
        // @GeoSpatialIndexed sem `type` cria um índice 2d LEGADO — o default da
        // anotação é GEO_2D. O nome "..._2dsphere" não muda o que é criado: um índice
        // 2d recusa GeoJSON na gravação (WriteError 16804) e confunde o planejador.
        // Procura cada índice pelo NOME declarado. Achatar o `key` de todos numa
        // tabela campo→tipo mediria o índice errado assim que qualquer outro índice
        // mencionasse `localizacao` ou `geofence` — listIndexes() não garante ordem.
        Map<String, Document> chavePorIndice = new java.util.HashMap<>();
        for (Document indice : mongoTemplate.getCollection(
                mongoTemplate.getCollectionName(HospitalDocument.class)).listIndexes()) {
            chavePorIndice.put(indice.getString("name"), (Document) indice.get("key"));
        }

        assertThat(chavePorIndice).containsKeys("localizacao_2dsphere", "geofence_2dsphere");
        assertThat(chavePorIndice.get("localizacao_2dsphere"))
                .containsEntry("localizacao", "2dsphere");
        assertThat(chavePorIndice.get("geofence_2dsphere"))
                .containsEntry("geofence", "2dsphere");
    }

    @Test
    @DisplayName("a listagem por raio devolve só o que está dentro do raio, sem erro do servidor")
    void listaPorRaioSemErroDoServidor() {
        // ~0,5 km ao norte do ponto de referência (1 grau de latitude ≈ 111 km).
        mongoTemplate.save(hospital("Perto", LAT + 0.0045, LON));
        // ~33 km ao norte — fora de qualquer raio de 5 km.
        mongoTemplate.save(hospital("Longe", LAT + 0.30, LON));

        PageResponse<HospitalResumoResponse> pagina =
                hospitalService.listar(LAT, LON, 5.0, null, null, 0, 20);

        assertThat(pagina.content()).extracting(HospitalResumoResponse::nome)
                .containsExactly("Perto");
        assertThat(pagina.totalElements()).isEqualTo(1);
    }

    @Test
    @DisplayName("o resultado sai ordenado por distância crescente")
    void ordenaPorDistanciaCrescente() {
        // Inseridos fora de ordem de propósito: se a ordenação viesse da inserção, e
        // não da consulta, este teste passaria por acidente. 1 grau de latitude ≈ 111 km.
        mongoTemplate.save(hospital("Terceiro", LAT + 0.090, LON));  // ~10,0 km
        mongoTemplate.save(hospital("Primeiro", LAT + 0.009, LON));  // ~1,0 km
        mongoTemplate.save(hospital("Quarto", LAT + 0.180, LON));    // ~20,0 km
        mongoTemplate.save(hospital("Segundo", LAT + 0.045, LON));   // ~5,0 km

        PageResponse<HospitalResumoResponse> pagina =
                hospitalService.listar(LAT, LON, 25.0, null, null, 0, 20);

        // F-07 depende desta ordem: a tela mostra o mais próximo primeiro. O
        // $geoNear antigo a garantia; o $nearSphere que o substituiu também — e é
        // isso que precisa continuar verdade depois da próxima mudança na consulta.
        assertThat(pagina.content()).extracting(HospitalResumoResponse::nome)
                .containsExactly("Primeiro", "Segundo", "Terceiro", "Quarto");
    }

    private HospitalDocument hospital(String nome, double lat, double lon) {
        double d = 0.001;
        GeoJsonPolygon geofence = new GeoJsonPolygon(List.of(
                new Point(lon - d, lat - d),
                new Point(lon + d, lat - d),
                new Point(lon + d, lat + d),
                new Point(lon - d, lat + d),
                new Point(lon - d, lat - d)));

        return HospitalDocument.builder()
                .nome(nome)
                .tipo(TipoEstabelecimento.PUBLICO)
                .categoria(CategoriaEstabelecimento.HOSPITAL)
                .geofence(geofence)
                .localizacao(new GeoJsonPoint(lon, lat))
                .ativo(true)
                .fonte("TESTE")
                .criadoEm(Instant.now())
                .atualizadoEm(Instant.now())
                .build();
    }
}
