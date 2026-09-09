package br.com.saude_monitor.api.hospital.seed;

import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lê o arquivo real de {@code backend/data/hospitais_publicos_complementares.json} —
 * mesmo contrato de {@code SeedParsersTest} para os DBF/SHP: valida contra o arquivo
 * efetivamente versionado, não contra uma fixture separada que poderia divergir dele.
 */
class HospitalPublicoComplementarLeitorTest {

    private static final Path ARQUIVO = Path.of("data", "hospitais_publicos_complementares.json");

    private final HospitalPublicoComplementarLeitor leitor = new HospitalPublicoComplementarLeitor();

    @Test
    void leTodosOsRegistrosDoArquivo() {
        List<HospitalPublicoComplementarRecord> registros = leitor.ler(ARQUIVO);

        assertThat(registros).hasSize(1);
        assertThat(registros).allSatisfy(r -> {
            assertThat(r.nome()).isNotBlank();
            assertThat(r.codigoCnes()).isNotBlank();
            assertThat(r.latitude()).isNotNull();
            assertThat(r.longitude()).isNotNull();
        });
    }

    @Test
    void leInstitutoDeCardiologiaComCamposEsperados() {
        List<HospitalPublicoComplementarRecord> registros = leitor.ler(ARQUIVO);

        HospitalPublicoComplementarRecord instituto = registros.getFirst();

        assertThat(instituto.nome()).isEqualTo("INSTITUTO DE CARDIOLOGIA E TRANSPLANTES DO DISTRITO FEDERAL");
        assertThat(instituto.codigoCnes()).isEqualTo("3276678");
        assertThat(instituto.bairro()).isEqualTo("CRUZEIRO NOVO");
        assertThat(instituto.latitude()).isEqualTo(-15.801428);
        assertThat(instituto.longitude()).isEqualTo(-47.935961);
    }

    @Test
    void lancaExcecaoParaArquivoInexistente() {
        Path inexistente = Path.of("data", "nao-existe.json");

        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,
                () -> leitor.ler(inexistente));
    }
}
