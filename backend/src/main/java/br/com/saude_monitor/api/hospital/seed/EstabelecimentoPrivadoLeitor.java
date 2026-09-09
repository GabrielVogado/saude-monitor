package br.com.saude_monitor.api.hospital.seed;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Lê o arquivo {@code estabelecimentos_privados.json} (extrato do CNES/DATASUS, hospitais
 * privados/filantrópicos do DF) em {@link EstabelecimentoPrivadoRecord}.
 *
 * <p>Arquivo estático em {@code backend/data/}, lido no boot exatamente como os DBF/SHP da
 * rede pública — sem chamada de rede. Ver o relatório de importação em
 * {@code Documentos/07-dados/} para a proveniência dos dados (filtro UF=DF, tipo hospitalar,
 * dedup contra a base já existente).</p>
 */
@Component
public class EstabelecimentoPrivadoLeitor {

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Lê todos os registros do arquivo. Lança {@link IllegalArgumentException} em caso de
     * falha de leitura/parse.
     */
    public List<EstabelecimentoPrivadoRecord> ler(Path arquivo) {
        try (InputStream in = Files.newInputStream(arquivo)) {
            return objectMapper.readValue(in, new com.fasterxml.jackson.core.type.TypeReference<
                    List<EstabelecimentoPrivadoRecord>>() {
            });
        } catch (IOException e) {
            throw new IllegalArgumentException("Falha ao ler o JSON de estabelecimentos privados: " + arquivo, e);
        }
    }
}
