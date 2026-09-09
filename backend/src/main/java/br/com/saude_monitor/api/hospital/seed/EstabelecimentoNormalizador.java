package br.com.saude_monitor.api.hospital.seed;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;

/**
 * Normalização de nome/endereço/CNES/CEP e validação de coordenada, compartilhadas
 * entre os dois leitores de seed: o pipeline DBF/SHP da rede pública do GDF
 * ({@link SeedMapper#montar}) e o pipeline JSON do CNES/DATASUS para hospitais
 * privados/filantrópicos ({@link SeedMapper#montarPrivado}).
 *
 * <p>Extraída de {@code SeedMapper} em 08/09/2026 — antes da extração, adicionar a
 * segunda fonte (JSON) exigiria reimplementar Title Case/CNES/CEP pela segunda vez,
 * exatamente o padrão de duplicação que a auditoria de código morto/lógica ambígua
 * já tinha encontrado em outros pontos do backend (RN-17, normalização de e-mail).</p>
 */
final class EstabelecimentoNormalizador {

    /** Partículas que permanecem minúsculas no Title Case (especificação do ETL). */
    private static final Set<String> PARTICULAS_MINUSCULAS = Set.of(
            "de", "da", "do", "das", "dos", "e", "a", "o", "em", "na", "no");

    /** Bounding box do Distrito Federal (lat/lon em graus). */
    static final double LAT_MIN = -16.20;
    static final double LAT_MAX = -15.40;
    static final double LON_MIN = -48.30;
    static final double LON_MAX = -47.30;

    private EstabelecimentoNormalizador() {
    }

    /** Coordenada válida: não nula-ilha (0,0), dentro dos limites globais e do bbox do DF (com tolerância). */
    static boolean coordenadaValida(double lon, double lat, double toleranciaBbox) {
        if (lon == 0.0 && lat == 0.0) {
            return false;
        }
        if (!(-180.0 <= lon && lon <= 180.0 && -90.0 <= lat && lat <= 90.0)) {
            return false;
        }
        return (LAT_MIN - toleranciaBbox <= lat && lat <= LAT_MAX + toleranciaBbox
                && LON_MIN - toleranciaBbox <= lon && lon <= LON_MAX + toleranciaBbox);
    }

    /** Title Case com partículas minúsculas (nomes de estabelecimento). */
    static String normalizarNome(String s) {
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
    static String normalizarTexto(String s) {
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
    static String canonicalizar(String s) {
        return colapsar(semAcento(s).toLowerCase(Locale.ROOT));
    }

    /** Remove dígitos não-numéricos e completa à esquerda até 7 posições. */
    static String normalizarCnes(String s) {
        if (s == null) {
            return null;
        }
        StringBuilder digitos = new StringBuilder();
        for (char c : s.toCharArray()) {
            if (Character.isDigit(c)) {
                digitos.append(c);
            }
        }
        if (digitos.isEmpty()) {
            return null;
        }
        String d = digitos.toString();
        while (d.length() < 7) {
            d = "0" + d;
        }
        return d;
    }

    /** Formata CEP como {@code #####-###}; null se não houver exatamente 8 dígitos. */
    static String normalizarCep(String s) {
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
    static Boolean simNaoParaBool(String s) {
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

    /** Corrige U+FFFD (ex.: "N�" → "Nº") e colapsa espaços. */
    static String limparCaracteresInvalidos(String s) {
        s = s.replace("N�", "Nº").replace("n�", "nº");
        s = s.replace("�", " ");
        return colapsar(s);
    }

    static String semAcento(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }

    static String colapsar(String s) {
        return s.trim().replaceAll("\\s+", " ");
    }

    /** Equivalente a {@code str.capitalize()} do Python: 1ª letra maiúscula, resto minúsculo. */
    static String capitalizePalavra(String s) {
        if (s.isEmpty()) {
            return s;
        }
        return s.substring(0, 1).toUpperCase(Locale.ROOT) + s.substring(1).toLowerCase(Locale.ROOT);
    }
}
