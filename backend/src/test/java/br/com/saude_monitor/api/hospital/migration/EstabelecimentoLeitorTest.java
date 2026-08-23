package br.com.saude_monitor.api.hospital.migration;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Testes unitários do leitor de importação (CSV e JSON), sem dependência de MongoDB.
 */
class EstabelecimentoLeitorTest {

    private final EstabelecimentoLeitor leitor = new EstabelecimentoLeitor();

    @TempDir
    Path tempDir;

    @Test
    void deveLerCsvComCabecalhosVariaveis() throws Exception {
        String csv = """
                CODIGO_CNES,CNPJ,NOME_FANTASIA,LATITUDE,LONGITUDE
                0010456,12.345.678/0001-90,HOSPITAL REGIONAL,-15.78,-47.88
                0067890,,UBS ASA NORTE,-15.77,-47.86
                """;
        Path arquivo = tempDir.resolve("estabelecimentos.csv");
        Files.writeString(arquivo, csv);

        List<EstabelecimentoSaudeRaw> registros = leitor.ler(arquivo, "CSV");

        assertEquals(2, registros.size());

        EstabelecimentoSaudeRaw primeiro = registros.get(0);
        assertEquals("0010456", primeiro.codigoCnes());
        assertEquals("12.345.678/0001-90", primeiro.cnpj());
        assertEquals("HOSPITAL REGIONAL", primeiro.nomeFantasia());
        assertEquals(-15.78, primeiro.latitude(), 1e-9);
        assertEquals(-47.88, primeiro.longitude(), 1e-9);

        assertNull(registros.get(1).cnpj());
    }

    @Test
    void deveLerJsonArray() throws Exception {
        String json = """
                [
                  { "codigo_cnes": "0010456", "nome_fantasia": "HOSPITAL REGIONAL", "latitude": -15.78, "longitude": -47.88 },
                  { "codigoCnes": "0067890", "nomeFantasia": "UBS ASA NORTE", "latitude": -15.77, "longitude": -47.86 }
                ]
                """;
        Path arquivo = tempDir.resolve("estabelecimentos.json");
        Files.writeString(arquivo, json);

        List<EstabelecimentoSaudeRaw> registros = leitor.ler(arquivo, "JSON");

        assertEquals(2, registros.size());
        // Tolerância a snake_case e camelCase nas chaves.
        assertEquals("0010456", registros.get(0).codigoCnes());
        assertEquals("0067890", registros.get(1).codigoCnes());
        assertEquals(-15.77, registros.get(1).latitude(), 1e-9);
    }
}
