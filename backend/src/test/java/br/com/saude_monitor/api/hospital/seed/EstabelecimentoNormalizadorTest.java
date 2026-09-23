package br.com.saude_monitor.api.hospital.seed;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cobre a normalização compartilhada entre os dois pipelines de seed (DBF/SHP da rede
 * pública e JSON do CNES para privados). Extraída de {@code SeedMapper} em 08/09/2026
 * — estes testes fixam o comportamento antes/depois da extração.
 */
class EstabelecimentoNormalizadorTest {

    @Test
    void coordenadaValidaAceitaDentroDoBboxDoDf() {
        assertThat(EstabelecimentoNormalizador.coordenadaValida(-48.05, -15.80, 0.0)).isTrue();
    }

    @Test
    void coordenadaValidaRejeitaOrigemNulaIlha() {
        assertThat(EstabelecimentoNormalizador.coordenadaValida(0.0, 0.0, 0.0)).isFalse();
    }

    @Test
    void coordenadaValidaRejeitaForaDosLimitesGlobais() {
        assertThat(EstabelecimentoNormalizador.coordenadaValida(-200.0, -15.80, 0.0)).isFalse();
        assertThat(EstabelecimentoNormalizador.coordenadaValida(-48.05, 95.0, 0.0)).isFalse();
    }

    @Test
    void coordenadaValidaRejeitaForaDoBboxDoDfSemTolerancia() {
        // Rio de Janeiro, bem fora do DF.
        assertThat(EstabelecimentoNormalizador.coordenadaValida(-43.20, -22.90, 0.0)).isFalse();
    }

    @Test
    void coordenadaValidaAceitaDentroDaToleranciaDoBbox() {
        // Um pouco além de LAT_MAX (-15.40), mas dentro da tolerância de 0.1.
        assertThat(EstabelecimentoNormalizador.coordenadaValida(-48.05, -15.35, 0.1)).isTrue();
    }

    @Test
    void normalizarNomeAplicaTitleCaseComParticulasMinusculas() {
        assertThat(EstabelecimentoNormalizador.normalizarNome("HOSPITAL DE BASE DO DISTRITO FEDERAL"))
                .isEqualTo("Hospital de Base do Distrito Federal");
    }

    @Test
    void normalizarNomeColapsaEspacosMultiplos() {
        assertThat(EstabelecimentoNormalizador.normalizarNome("HOSPITAL   AGUAS  CLARAS"))
                .isEqualTo("Hospital Aguas Claras");
    }

    @Test
    void normalizarNomeRetornaNuloParaEntradaNulaOuVazia() {
        assertThat(EstabelecimentoNormalizador.normalizarNome(null)).isNull();
        assertThat(EstabelecimentoNormalizador.normalizarNome("   ")).isNull();
    }

    @Test
    void normalizarTextoAplicaTitleCaseEmTodasAsPalavras() {
        assertThat(EstabelecimentoNormalizador.normalizarTexto("R ARARIBA LOTE 03 E"))
                .isEqualTo("R Arariba Lote 03 E");
    }

    @Test
    void canonicalizarRemoveAcentoEColapsaCaixa() {
        assertThat(EstabelecimentoNormalizador.canonicalizar("Hospital São Vicente de Paulo"))
                .isEqualTo("hospital sao vicente de paulo");
    }

    @Test
    void normalizarCnesCompletaComZerosAEsquerda() {
        assertThat(EstabelecimentoNormalizador.normalizarCnes("49867")).isEqualTo("0049867");
    }

    @Test
    void normalizarCnesExtraiApenasDigitos() {
        assertThat(EstabelecimentoNormalizador.normalizarCnes("CNES-185256")).isEqualTo("0185256");
    }

    @Test
    void normalizarCnesRetornaNuloSemDigitos() {
        assertThat(EstabelecimentoNormalizador.normalizarCnes(null)).isNull();
        assertThat(EstabelecimentoNormalizador.normalizarCnes("N/D")).isNull();
    }

    @Test
    void normalizarCepFormataComHifen() {
        assertThat(EstabelecimentoNormalizador.normalizarCep("71927360")).isEqualTo("71927-360");
    }

    @Test
    void normalizarCepRetornaNuloSemOitoDigitos() {
        assertThat(EstabelecimentoNormalizador.normalizarCep("123")).isNull();
        assertThat(EstabelecimentoNormalizador.normalizarCep(null)).isNull();
    }

    @Test
    void simNaoParaBoolConverteVariacoesTolerantes() {
        assertThat(EstabelecimentoNormalizador.simNaoParaBool("SIM")).isTrue();
        assertThat(EstabelecimentoNormalizador.simNaoParaBool("s")).isTrue();
        assertThat(EstabelecimentoNormalizador.simNaoParaBool("NÃO")).isFalse();
        assertThat(EstabelecimentoNormalizador.simNaoParaBool("n")).isFalse();
        assertThat(EstabelecimentoNormalizador.simNaoParaBool("talvez")).isNull();
        assertThat(EstabelecimentoNormalizador.simNaoParaBool(null)).isNull();
    }

    @Test
    void limparCaracteresInvalidosCorrigeReplacementCharacter() {
        assertThat(EstabelecimentoNormalizador.limparCaracteresInvalidos("QNM 16 CONJUNTO N� 07"))
                .isEqualTo("QNM 16 CONJUNTO Nº 07");
    }
}
