package br.com.saude_monitor.api.hospital.seed;

import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import lombok.Getter;

import java.util.Optional;
import java.util.Set;

/**
 * Camadas de estabelecimentos de saúde do DF (shapefile + DBF) que entram no seed.
 *
 * <p>Cada constante associa o <em>stem</em> do arquivo (ex.: {@code "Hospitais"} →
 * {@code Hospitais.dbf}/{@code Hospitais.shp}) à categoria assistencial e às chaves
 * <strong>canonicalizadas</strong> dos campos do DBF. A canonicalização é
 * minúsculas + sem acento + sem separadores (ex.: {@code "Sala_Vacin"} → {@code salavacin}),
 * replicando o comportamento do leitor existente para tolerar variações de cabeçalho.</p>
 *
 * <p>O campo {@code nome} pode ser {@code null} (camada sem coluna de nome, ex.: UBS
 * prisionais); nesse caso o seed deriva o nome a partir da Região Administrativa.</p>
 *
 * <p>Camadas de LIMITE (regiões/macrorregiões) não são estabelecimentos e são ignoradas
 * ({@link #CAMADAS_IGNORADAS}).</p>
 */
@Getter
public enum CamadaEstabelecimento {

    HOSPITAIS("Hospitais", CategoriaEstabelecimento.HOSPITAL,
            "hospitais", null, null, null, null, null, null,
            "endereco", "numero", "cep", "ra"),

    UNIDADES_PRONTO_ATENDIMENTO("Unidades_de_Pronto_Atendi", CategoriaEstabelecimento.UPA,
            "unidadesd", null, null, null, null, null, null,
            "endereco", "numero", "cep", "ra"),

    UNIDADE_BASICA_SAUDE("Unidade_Básica_de_Saúde", CategoriaEstabelecimento.UBS,
            "ubs", "cnes", "horfunc", "salavacin", "farmacia", "colamater", null,
            "endereco", null, "cep", "ra"),

    UBS_UNIDADES_PRISIONAIS("UBS_-_Unidades_Prisionais", CategoriaEstabelecimento.UBS,
            null, null, null, null, null, null, null,
            "endereco", null, "cep", "ra"),

    UBS_SAUDE_INDIGENA("UBS_-_Saúde_Indígena", CategoriaEstabelecimento.UBS,
            "ubsindig", null, "horfunc", null, null, null, null,
            "endereco", null, "cep", "ra"),

    UBS_CONSULTORIO_RUA("UBS_-_Consultório_na_rua", CategoriaEstabelecimento.UBS,
            "ubsrua", null, null, null, null, null, null,
            "endereco", null, "cep", "ra"),

    POLICLINICAS("Policlínicas", CategoriaEstabelecimento.POLICLINICA,
            "policlinic", "cnes", "horfunc", null, null, null, null,
            "endereco", "numero", "cep", "ra"),

    CENTROS_ATENCAO_PSICOSSOCIAL("Centros_de_Atenção_Psicos", CategoriaEstabelecimento.CAPS,
            "caps", null, null, null, null, null, null,
            "endereco", "numero", "cep", "ra"),

    CENTROS_ESPECIALIZADOS("Centros_Especializados", CategoriaEstabelecimento.CENTRO_ESPECIALIZADO,
            "ce", "cnes", null, null, null, null, "tipounid",
            "endereco", "numero", "cep", "ra"),

    OUTRAS_UNIDADES("Outras_Unidades_de_Saúde", CategoriaEstabelecimento.OUTRO,
            "ous", "cnes", null, null, null, null, "tipounid",
            "endereco", "numero", "cep", "ra");

    /** Stems das camadas de LIMITE/regiões que NÃO entram na coleção {@code hospitais}. */
    public static final Set<String> CAMADAS_IGNORADAS = Set.of(
            "Macrorregiões_de_Saúde",
            "Região_Integrada_de_Desen",
            "Regiões_Administrativas",
            "Regiões_de_Saúde");

    private final String stem;
    private final CategoriaEstabelecimento categoria;

    // Chaves canonicalizadas dos campos do DBF (null = campo ausente na camada).
    private final String nome;
    private final String cnes;
    private final String horario;
    private final String salaVacina;
    private final String farmacia;
    private final String coletaMaterial;
    private final String tipoUnidade;
    private final String endereco;
    private final String numero;
    private final String cep;
    private final String bairro;

    CamadaEstabelecimento(String stem, CategoriaEstabelecimento categoria,
                          String nome, String cnes, String horario, String salaVacina,
                          String farmacia, String coletaMaterial, String tipoUnidade,
                          String endereco, String numero, String cep, String bairro) {
        this.stem = stem;
        this.categoria = categoria;
        this.nome = nome;
        this.cnes = cnes;
        this.horario = horario;
        this.salaVacina = salaVacina;
        this.farmacia = farmacia;
        this.coletaMaterial = coletaMaterial;
        this.tipoUnidade = tipoUnidade;
        this.endereco = endereco;
        this.numero = numero;
        this.cep = cep;
        this.bairro = bairro;
    }

    /** Resolve a camada pelo stem do arquivo (sem extensão). */
    public static Optional<CamadaEstabelecimento> porStem(String stem) {
        for (CamadaEstabelecimento c : values()) {
            if (c.stem.equals(stem)) {
                return Optional.of(c);
            }
        }
        return Optional.empty();
    }
}
