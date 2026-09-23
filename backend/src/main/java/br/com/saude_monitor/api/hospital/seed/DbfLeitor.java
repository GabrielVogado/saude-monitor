package br.com.saude_monitor.api.hospital.seed;

import com.linuxense.javadbf.DBFRow;
import com.linuxense.javadbf.DBFReader;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Lê os atributos de um arquivo {@code .dbf} (dBase/XBase) usando a biblioteca
 * leve JavaDBF ({@code com.github.albfernandez:javadbf}).
 *
 * <p>Cada registro é retornado como um {@code Map<String,String>} cujas chaves são as
 * chaves <em>canonicalizadas</em> das colunas (minúsculas, sem acento, sem separadores),
 * permitindo acesso tolerante a variações de cabeçalho entre as camadas.</p>
 *
 * <p>O charset é informado pelo seed ({@link StandardCharsets#UTF_8}, conforme o arquivo
 * {@code .cpg} que acompanha os shapefiles), sobrepondo o byte de idioma do DBF.</p>
 */
@Component
public class DbfLeitor {

    /**
     * Lê todas as linhas do DBF, descartando campos nulos/vazios.
     * Lança {@link IllegalArgumentException} em caso de falha de leitura.
     */
    public List<Map<String, String>> ler(Path arquivo, Charset charset) {
        try (InputStream in = Files.newInputStream(arquivo);
             DBFReader reader = new DBFReader(in, charset)) {

            int totalCampos = reader.getFieldCount();
            List<Map<String, String>> linhas = new ArrayList<>();

            DBFRow row;
            while ((row = reader.nextRow()) != null) {
                Map<String, String> linha = new HashMap<>();
                for (int i = 0; i < totalCampos; i++) {
                    String nomeCampo = reader.getField(i).getName();
                    String valor = row.getString(nomeCampo);
                    if (valor != null && !valor.isBlank()) {
                        linha.put(canonicalizar(nomeCampo), valor.trim());
                    }
                }
                linhas.add(linha);
            }
            return linhas;

        } catch (Exception e) {
            throw new IllegalArgumentException("Falha ao ler o DBF: " + arquivo, e);
        }
    }

    /** Minúsculas + sem acento + sem separadores (tolerante a variações de cabeçalho). */
    static String canonicalizar(String chave) {
        String semAcento = Normalizer.normalize(chave, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return semAcento.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }
}
