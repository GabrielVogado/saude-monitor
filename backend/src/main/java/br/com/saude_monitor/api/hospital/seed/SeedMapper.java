package br.com.saude_monitor.api.hospital.seed;

import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.ContatoDocument;
import br.com.saude_monitor.api.hospital.document.EnderecoDocument;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import br.com.saude_monitor.api.hospital.service.GeofenceFactory;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.geo.GeoJsonPolygon;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;

/**
 * Converte um registro do seed (linha DBF + ponto SHP) em {@link HospitalDocument},
 * replicando fielmente as regras de normalização do pipeline ETL de referência:
 *
 * <ul>
 *   <li>nome em Title Case com partículas minúsculas (de, da, do, das, dos, e, a, o, em, na, no);</li>
 *   <li>logradouro/bairro em Title Case (todas as palavras);</li>
 *   <li>CNES: só dígitos, completado à esquerda até 7 posições (zfill);</li>
 *   <li>CEP: formato {@code #####-###} (null se inválido);</li>
 *   <li>SIM/NÃO → {@code Boolean} (tolerante a variações);</li>
 *   <li>correção de {@code U+FFFD} (ex.: "Nº" corrompido para "N�");</li>
 *   <li>{@code importKey} = sha256({@code categoria|nomeCanonico|lon|lat}) para registros sem CNES;</li>
 *   <li>geofence circular por categoria via {@link GeofenceFactory}.</li>
 * </ul>
 *
 * <p>Retorna {@code null} para registros com coordenada inválida (fora do bbox do DF com
 * tolerância) ou sem nome — o runner descarta e contabiliza.</p>
 *
 * <p>A normalização (Title Case, CNES, CEP, validação de coordenada) vive em
 * {@link EstabelecimentoNormalizador}, compartilhada com {@link #montarPublicoComplementar}
 * (fonte JSON do CNES/DATASUS para hospitais públicos ausentes da fonte InfoSaúde/GDF).</p>
 */
@Component
public class SeedMapper {

    /** Fonte declarada no campo {@code fonte} dos registros vindos do JSON complementar. */
    static final String FONTE_PUBLICOS_COMPLEMENTARES_CNES = "CNES_HOSPITAIS_PUBLICOS_COMPLEMENTARES";

    private final SeedProperties properties;
    private final GeofenceFactory geofenceFactory;

    public SeedMapper(SeedProperties properties, GeofenceFactory geofenceFactory) {
        this.properties = properties;
        this.geofenceFactory = geofenceFactory;
    }

    /**
     * Monta o documento a partir de uma linha de atributos e de um ponto de geometria.
     * Retorna {@code null} quando o registro deve ser descartado (coordenada inválida
     * ou ausência de nome).
     */
    public HospitalDocument montar(CamadaEstabelecimento camada, Map<String, String> linha,
                                   double lon, double lat) {
        if (!EstabelecimentoNormalizador.coordenadaValida(lon, lat, properties.toleranciaBbox())) {
            return null;
        }

        // Nome — deriva da Região Administrativa quando a camada não tem coluna de nome.
        String nome = valor(linha, camada.getNome());
        if (nome == null) {
            String ra = EstabelecimentoNormalizador.normalizarNome(valor(linha, camada.getBairro()));
            if (ra != null) {
                nome = EstabelecimentoNormalizador.normalizarNome("UBS " + ra);
            }
        }
        nome = EstabelecimentoNormalizador.normalizarNome(nome);
        if (nome == null) {
            return null; // sem nome e sem RA: registro irrecuperável
        }

        String cnes = EstabelecimentoNormalizador.normalizarCnes(valor(linha, camada.getCnes()));
        String nomeCanonico = EstabelecimentoNormalizador.canonicalizar(nome);

        Instant agora = Instant.now();
        double raio = properties.raio(camada.getCategoria());
        GeoJsonPoint localizacao = new GeoJsonPoint(lon, lat);
        GeoJsonPolygon geofence = geofenceFactory.criarCirculo(
                lat, lon, raio, GeofenceFactory.LADOS_CIRCULO);

        EnderecoDocument endereco = EnderecoDocument.builder()
                .logradouro(EstabelecimentoNormalizador.normalizarTexto(valor(linha, camada.getEndereco())))
                .numero(valor(linha, camada.getNumero()))
                .complemento(null)
                .bairro(EstabelecimentoNormalizador.normalizarTexto(valor(linha, camada.getBairro())))
                .cidade("Brasília")
                .uf("DF")
                .cep(EstabelecimentoNormalizador.normalizarCep(valor(linha, camada.getCep())))
                .build();

        HospitalDocument.HospitalDocumentBuilder builder = HospitalDocument.builder()
                .nome(nome)
                .tipo(TipoEstabelecimento.PUBLICO)
                .categoria(camada.getCategoria())
                .horarioFuncionamento(valor(linha, camada.getHorario()))
                .salaVacina(EstabelecimentoNormalizador.simNaoParaBool(valor(linha, camada.getSalaVacina())))
                .farmacia(EstabelecimentoNormalizador.simNaoParaBool(valor(linha, camada.getFarmacia())))
                .coletaMaterial(EstabelecimentoNormalizador.simNaoParaBool(valor(linha, camada.getColetaMaterial())))
                .tipoUnidade(valor(linha, camada.getTipoUnidade()))
                .endereco(endereco)
                .contato(ContatoDocument.builder().telefone(null).email(null).build())
                .geofence(geofence)
                .localizacao(localizacao)
                .ativo(true)
                .fonte(properties.lote())
                .criadoEm(agora)
                .atualizadoEm(agora);

        if (cnes != null) {
            builder.codigoCnes(cnes);
        } else {
            // Dedup de registros SEM CNES (Hospitais/UPAs/CAPs/variantes UBS).
            builder.importKey(gerarImportKey(camada.getCategoria(), nomeCanonico, lon, lat));
        }
        return builder.build();
    }

    /**
     * Monta o documento a partir de um registro do CNES/DATASUS — hospitais PÚBLICOS que
     * o CNES lista no DF mas que não aparecem na fonte InfoSaúde/GDF (fonte JSON, ver
     * {@link HospitalPublicoComplementarLeitor}).
     *
     * <p>Fonte exclusiva de hospitais PÚBLICOS — hospitais privados/filantrópicos ficam
     * fora de escopo por decisão do PO (08/09/2026, ver
     * {@code Documentos/07-dados/relatorio-importacao-CNES_PUBLICOS_COMPLEMENTARES_20260909.md}).
     * Por isso {@code tipo} é sempre {@link TipoEstabelecimento#PUBLICO}, fixo — não há
     * campo de classificação a ler do registro nem risco de importar algo fora do
     * escopo atual por engano.</p>
     *
     * <p>Diferente de {@link #montar}, esta fonte já traz coordenadas próprias (CNES
     * publica {@code NU_LATITUDE}/{@code NU_LONGITUDE}) e exige CNES para dedup estável
     * — sem CNES, o registro é descartado (não há geometria de referência como no
     * pipeline DBF/SHP para gerar um {@code importKey} confiável).</p>
     */
    public HospitalDocument montarPublicoComplementar(HospitalPublicoComplementarRecord registro) {
        if (registro.latitude() == null || registro.longitude() == null) {
            return null;
        }
        double lon = registro.longitude();
        double lat = registro.latitude();
        if (!EstabelecimentoNormalizador.coordenadaValida(lon, lat, properties.toleranciaBbox())) {
            return null;
        }

        String nome = EstabelecimentoNormalizador.normalizarNome(registro.nome());
        if (nome == null) {
            return null;
        }

        String cnes = EstabelecimentoNormalizador.normalizarCnes(registro.codigoCnes());
        if (cnes == null) {
            return null; // fonte exige CNES para dedup estável
        }

        Instant agora = Instant.now();
        double raio = properties.raio(CategoriaEstabelecimento.HOSPITAL);
        GeoJsonPoint localizacao = new GeoJsonPoint(lon, lat);
        GeoJsonPolygon geofence = geofenceFactory.criarCirculo(
                lat, lon, raio, GeofenceFactory.LADOS_CIRCULO);

        EnderecoDocument endereco = EnderecoDocument.builder()
                .logradouro(EstabelecimentoNormalizador.normalizarTexto(registro.logradouro()))
                .numero(registro.numero() == null ? null : EstabelecimentoNormalizador.colapsar(registro.numero()))
                .complemento(null)
                .bairro(EstabelecimentoNormalizador.normalizarTexto(registro.bairro()))
                .cidade("Brasília")
                .uf("DF")
                .cep(EstabelecimentoNormalizador.normalizarCep(registro.cep()))
                .build();

        return HospitalDocument.builder()
                .nome(nome)
                .tipo(TipoEstabelecimento.PUBLICO)
                .categoria(CategoriaEstabelecimento.HOSPITAL)
                .endereco(endereco)
                .contato(ContatoDocument.builder().telefone(null).email(null).build())
                .geofence(geofence)
                .localizacao(localizacao)
                .ativo(true)
                .fonte(FONTE_PUBLICOS_COMPLEMENTARES_CNES)
                .codigoCnes(cnes)
                .criadoEm(agora)
                .atualizadoEm(agora)
                .build();
    }

    // ------------------------------------------------------------------
    // Extração / sanitização (pipeline DBF)
    // ------------------------------------------------------------------

    /** Extrai o valor do campo (chave canonicalizada), sanitiza e converte vazio em null. */
    private static String valor(Map<String, String> linha, String chaveCanonica) {
        if (chaveCanonica == null) {
            return null;
        }
        String v = linha.get(chaveCanonica);
        if (v == null) {
            return null;
        }
        String limpo = EstabelecimentoNormalizador.limparCaracteresInvalidos(v);
        return limpo.isEmpty() ? null : limpo;
    }

    // ------------------------------------------------------------------
    // Dedup (registros sem CNES)
    // ------------------------------------------------------------------

    /** sha256({@code categoria|nomeCanonico|lon|lat}) — chave de dedup sem CNES. */
    private static String gerarImportKey(CategoriaEstabelecimento categoria, String nomeCanonico,
                                         double lon, double lat) {
        String raw = categoria.name() + "|" + nomeCanonico + "|"
                + String.format(Locale.ROOT, "%.6f", lon) + "|"
                + String.format(Locale.ROOT, "%.6f", lat);
        return sha256Hex(raw);
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(String.format(Locale.ROOT, "%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível na JVM", e);
        }
    }
}
