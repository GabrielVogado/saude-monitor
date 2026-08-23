package br.com.saude_monitor.api.hospital.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.geo.GeoJsonPolygon;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexed;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Documento MongoDB da coleção {@code hospitais} (Épico 01 — Cadastro de Hospitais e Geofences).
 *
 * <p>Modela o cadastro do estabelecimento de saúde com sua área geográfica (geofence)
 * como polígono GeoJSON e sua localização central (ponto GeoJSON). Ambos são indexados
 * com {@code 2dsphere} para consultas {@code $geoIntersects} (detecção de entrada — Épico 02)
 * e {@code $near} (listagem por raio — Épico 01).</p>
 *
 * <p>Decisão de unicidade (desvio documentado da spec, que propõe {@code nome} único):
 * {@code nome} NÃO é único no índice para suportar a importação de UPAs/UBS que podem
 * compartilhar razão social; a unicidade de cadastro administrativo (nome + CNPJ) é
 * garantida na camada de serviço. A chave estável de deduplicação da importação é
 * {@link #codigoCnes}.</p>
 */
@Document(collection = "hospitais")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@CompoundIndex(name = "idx_ativo_tipo", def = "{ 'ativo': 1, 'tipo': 1 }")
public class HospitalDocument {

    @Id
    private String id;

    /** Nome fantasia / razão social do estabelecimento. */
    private String nome;

    /** CNPJ no formato {@code XX.XXX.XXX/XXXX-XX}. Opcional (UPA/UBS podem não ter CNPJ próprio). */
    @Indexed(unique = true, sparse = true)
    private String cnpj;

    /** Natureza administrativa: PUBLICO | PRIVADO | FILANTROPICO. */
    private TipoEstabelecimento tipo;

    /** Categoria assistencial: HOSPITAL | UPA | UBS | POLICLINICA | CAPS | CENTRO_ESPECIALIZADO | OUTRO. */
    private CategoriaEstabelecimento categoria;

    /**
     * Horário de funcionamento do estabelecimento (texto livre, conforme a fonte).
     * Ex.: "De Segunda a Sexta das 07:00 às 19:00 e Sábado das 07:00 às 12:00".
     */
    private String horarioFuncionamento;

    /** Indica se o estabelecimento possui sala de vacina. Opcional (null quando não informado). */
    private Boolean salaVacina;

    /** Indica se o estabelecimento possui farmácia. Opcional (null quando não informado). */
    private Boolean farmacia;

    /** Indica se o estabelecimento realiza coleta de material para exames. Opcional. */
    private Boolean coletaMaterial;

    /** Tipo/classificação da unidade conforme a fonte (ex.: "CENTRO RADIOLÓGICO", "CEPAV …"). Opcional. */
    private String tipoUnidade;

    /** Código CNES (7 dígitos) — chave estável da importação de estabelecimentos do SUS. */
    @Indexed(unique = true, sparse = true)
    private String codigoCnes;

    /**
     * Chave de deduplicação de importação para registros SEM CNES (Hospitais e UPAs
     * de Brasília-DF não possuem CNES próprio). Calculada como
     * {@code sha256(categoria + "|" + nomeNormalizado + "|" + lon + "|" + lat)}.
     * Índice único esparso para upsert idempotente. Não é exposta na API.
     */
    @Indexed(unique = true, sparse = true)
    private String importKey;

    private EnderecoDocument endereco;

    private ContatoDocument contato;

    /**
     * Área geográfica (geofence) como polígono GeoJSON, anel fechado em ordem {@code [longitude, latitude]}.
     * Índice 2dsphere para {@code $geoIntersects}.
     */
    @GeoSpatialIndexed(name = "geofence_2dsphere")
    private GeoJsonPolygon geofence;

    /**
     * Ponto central (centroide) do geofence, usado na listagem por raio ({@code $near}).
     * Índice 2dsphere. Mantido explicitamente porque {@code $near} não opera sobre polígonos.
     */
    @GeoSpatialIndexed(name = "localizacao_2dsphere")
    private GeoJsonPoint localizacao;

    /** Soft delete — {@code false} remove o estabelecimento da listagem pública imediatamente. */
    private boolean ativo;

    /** Origem do registro: {@code CADASTRO} (admin) ou {@code IMPORTACAO} (CNES). Rastreabilidade. */
    private String fonte;

    private Instant criadoEm;

    private Instant atualizadoEm;
}
