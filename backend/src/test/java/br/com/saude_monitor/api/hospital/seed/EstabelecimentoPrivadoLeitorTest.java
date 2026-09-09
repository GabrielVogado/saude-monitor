package br.com.saude_monitor.api.hospital.seed;

import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lê o arquivo real de {@code backend/data/estabelecimentos_privados.json} — mesmo
 * contrato de {@code SeedParsersTest} para os DBF/SHP: valida contra o arquivo
 * efetivamente versionado, não contra uma fixture separada que poderia divergir dele.
 */
class EstabelecimentoPrivadoLeitorTest {

    private static final Path ARQUIVO = Path.of("data", "estabelecimentos_privados.json");

    private final EstabelecimentoPrivadoLeitor leitor = new EstabelecimentoPrivadoLeitor();

    @Test
    void leTodosOsRegistrosDoArquivo() {
        List<EstabelecimentoPrivadoRecord> registros = leitor.ler(ARQUIVO);

        assertThat(registros).hasSize(58);
        assertThat(registros).allSatisfy(r -> {
            assertThat(r.nome()).isNotBlank();
            assertThat(r.codigoCnes()).isNotBlank();
            assertThat(r.tipo()).isIn("PRIVADO", "FILANTROPICO");
            assertThat(r.latitude()).isNotNull();
            assertThat(r.longitude()).isNotNull();
        });
    }

    @Test
    void classificaAMaioriaComoPrivadoEAlgunsComoFilantropico() {
        List<EstabelecimentoPrivadoRecord> registros = leitor.ler(ARQUIVO);

        long privados = registros.stream().filter(r -> "PRIVADO".equals(r.tipo())).count();
        long filantropicos = registros.stream().filter(r -> "FILANTROPICO".equals(r.tipo())).count();

        assertThat(privados).isEqualTo(54);
        assertThat(filantropicos).isEqualTo(4);
    }

    @Test
    void leHospitalAguasClarasComCamposEsperados() {
        List<EstabelecimentoPrivadoRecord> registros = leitor.ler(ARQUIVO);

        EstabelecimentoPrivadoRecord aguasClaras = registros.stream()
                .filter(r -> "0049867".equals(EstabelecimentoNormalizador.normalizarCnes(r.codigoCnes())))
                .findFirst()
                .orElseThrow();

        assertThat(aguasClaras.nome()).isEqualTo("HOSPITAL AGUAS CLARAS");
        assertThat(aguasClaras.tipo()).isEqualTo("PRIVADO");
        assertThat(aguasClaras.latitude()).isEqualTo(-15.845841);
        assertThat(aguasClaras.longitude()).isEqualTo(-48.031202);
    }

    @Test
    void lancaExcecaoParaArquivoInexistente() {
        Path inexistente = Path.of("data", "nao-existe.json");

        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,
                () -> leitor.ler(inexistente));
    }
}
