package br.com.saude_monitor.api.hospital.seed;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Lê o arquivo {@code hospitais_publicos_complementares.json} (hospitais PÚBLICOS do
 * CNES/DATASUS ausentes da fonte InfoSaúde/GDF) em {@link HospitalPublicoComplementarRecord}.
 *
 * <p>Arquivo estático em {@code backend/data/}, lido no boot exatamente como os DBF/SHP da
 * rede pública — sem chamada de rede. Ver o relatório de importação em
 * {@code Documentos/07-dados/} para a proveniência dos dados.</p>
 */
@Component
public class HospitalPublicoComplementarLeitor {

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Lê todos os registros do arquivo. Lança {@link IllegalArgumentException} em caso de
     * falha de leitura/parse.
     */
    public List<HospitalPublicoComplementarRecord> ler(Path arquivo) {
        try (InputStream in = Files.newInputStream(arquivo)) {
            return objectMapper.readValue(in, new com.fasterxml.jackson.core.type.TypeReference<
                    List<HospitalPublicoComplementarRecord>>() {
            });
        } catch (IOException e) {
            throw new IllegalArgumentException(
                    "Falha ao ler o JSON de hospitais públicos complementares: " + arquivo, e);
        }
    }
}
