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
import java.text.Normalizer;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

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
 */
@Component
public class SeedMapper {

    /** Partículas que permanecem minúsculas no Title Case (especificação do ETL). */
    private static final Set<String> PARTICULAS_MINUSCULAS = Set.of(
            "de", "da", "do", "das", "dos", "e", "a", "o", "em", "na", "no");

    /** Bounding box do Distrito Federal (lat/lon em graus). */
    private static final double LAT_MIN = -16.20;
    private static final double LAT_MAX = -15.40;
    private static final double LON_MIN = -48.30;
    private static final double LON_MAX = -47.30;

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
        if (!coordenadaValida(lon, lat)) {
            return null;
        }

        // Nome — deriva da Região Administrativa quando a camada não tem coluna de nome.
        String nome = valor(linha, camada.getNome());
        if (nome == null) {
            String ra = normalizarNome(valor(linha, camada.getBairro()));
            if (ra != null) {
                nome = normalizarNome("UBS " + ra);
            }
        }
        nome = normalizarNome(nome);
        if (nome == null) {
            return null; // sem nome e sem RA: registro irrecuperável
        }

        String cnes = normalizarCnes(valor(linha, camada.getCnes()));
        String nomeCanonico = canonicalizar(nome);

        Instant agora = Instant.now();
        double raio = properties.raio(camada.getCategoria());
        GeoJsonPoint localizacao = new GeoJsonPoint(lon, lat);
        GeoJsonPolygon geofence = geofenceFactory.criarCirculo(
                lat, lon, raio, GeofenceFactory.LADOS_CIRCULO);

        EnderecoDocument endereco = EnderecoDocument.builder()
                .logradouro(normalizarTexto(valor(linha, camada.getEndereco())))
                .numero(valor(linha, camada.getNumero()))
                .complemento(null)
                .bairro(normalizarTexto(valor(linha, camada.getBairro())))
                .cidade("Brasília")
                .uf("DF")
                .cep(normalizarCep(valor(linha, camada.getCep())))
                .build();

        HospitalDocument.HospitalDocumentBuilder builder = HospitalDocument.builder()
                .nome(nome)
                .tipo(TipoEstabelecimento.PUBLICO)
                .categoria(camada.getCategoria())
                .horarioFuncionamento(valor(linha, camada.getHorario()))
                .salaVacina(simNaoParaBool(valor(linha, camada.getSalaVacina())))
                .farmacia(simNaoParaBool(valor(linha, camada.getFarmacia())))
                .coletaMaterial(simNaoParaBool(valor(linha, camada.getColetaMaterial())))
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

    // ------------------------------------------------------------------
    // Extração / sanitização
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
        String limpo = limparCaracteresInvalidos(v);
        return limpo.isEmpty() ? null : limpo;
    }

    /** Corrige U+FFFD (ex.: "N�" → "Nº") e colapsa espaços. */
    private static String limparCaracteresInvalidos(String s) {
        s = s.replace("N\uFFFD", "Nº").replace("n\uFFFD", "nº");
        s = s.replace("\uFFFD", " ");
        return colapsar(s);
    }

    private boolean coordenadaValida(double lon, double lat) {
        if (lon == 0.0 && lat == 0.0) {
            return false;
        }
        if (!(-180.0 <= lon && lon <= 180.0 && -90.0 <= lat && lat <= 90.0)) {
            return false;
        }
        double tol = properties.toleranciaBbox();
        return (LAT_MIN - tol <= lat && lat <= LAT_MAX + tol
                && LON_MIN - tol <= lon && lon <= LON_MAX + tol);
    }

    // ------------------------------------------------------------------
    // Normalização (espelha o ETL de referência)
    // ------------------------------------------------------------------

    /** Title Case com partículas minúsculas. */
    private static String normalizarNome(String s) {
        if (s == null) {
            return null;
        }
        String colapsado = colapsar(s);
        if (colapsado.isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        for (String p : colapsado.split(" ")) {
            if (p.isEmpty()) {
                continue;
            }
            String low = p.toLowerCase(Locale.ROOT);
            sb.append(PARTICULAS_MINUSCULAS.contains(low) ? low : capitalizePalavra(low))
                    .append(' ');
        }
        String resultado = sb.toString().trim();
        return resultado.isEmpty() ? null : resultado;
    }

    /** Title Case em TODAS as palavras (logradouro/bairro/cidade). */
    private static String normalizarTexto(String s) {
        if (s == null) {
            return null;
        }
        String colapsado = colapsar(s);
        if (colapsado.isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        for (String p : colapsado.split(" ")) {
            if (p.isEmpty()) {
                continue;
            }
            sb.append(capitalizePalavra(p)).append(' ');
        }
        String resultado = sb.toString().trim();
        return resultado.isEmpty() ? null : resultado;
    }

    /** Forma canônica para dedup: minúsculas, sem acento, espaços colapsados (mantém pontuação). */
    private static String canonicalizar(String s) {
        return colapsar(semAcento(s).toLowerCase(Locale.ROOT));
    }

    /** Remove dígitos não-numéricos e completa à esquerda até 7 posições. */
    private static String normalizarCnes(String s) {
        if (s == null) {
            return null;
        }
        StringBuilder digitos = new StringBuilder();
        for (char c : s.toCharArray()) {
            if (Character.isDigit(c)) {
                digitos.append(c);
            }
        }
        if (digitos.length() == 0) {
            return null;
        }
        String d = digitos.toString();
        while (d.length() < 7) {
            d = "0" + d;
        }
        return d;
    }

    /** Formata CEP como {@code #####-###}; null se não houver exatamente 8 dígitos. */
    private static String normalizarCep(String s) {
        if (s == null) {
            return null;
        }
        StringBuilder digitos = new StringBuilder();
        for (char c : s.toCharArray()) {
            if (Character.isDigit(c)) {
                digitos.append(c);
            }
        }
        if (digitos.length() != 8) {
            return null;
        }
        return digitos.substring(0, 5) + "-" + digitos.substring(5);
    }

    /** Converte "SIM"/"NÃO" (tolerante) em booleano; null se ausente/ambíguo. */
    private static Boolean simNaoParaBool(String s) {
        if (s == null) {
            return null;
        }
        String v = semAcento(s.trim()).toUpperCase(Locale.ROOT);
        if ("SIM".equals(v) || "S".equals(v)) {
            return true;
        }
        if ("NAO".equals(v) || "N".equals(v) || "NO".equals(v)) {
            return false;
        }
        return null;
    }

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

    // ------------------------------------------------------------------
    // Utilidades
    // ------------------------------------------------------------------

    private static String semAcento(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }

    private static String colapsar(String s) {
        return s.trim().replaceAll("\\s+", " ");
    }

    /** Equivalente a {@code str.capitalize()} do Python: 1ª letra maiúscula, resto minúsculo. */
    private static String capitalizePalavra(String s) {
        if (s.isEmpty()) {
            return s;
        }
        return s.substring(0, 1).toUpperCase(Locale.ROOT) + s.substring(1).toLowerCase(Locale.ROOT);
    }
}
