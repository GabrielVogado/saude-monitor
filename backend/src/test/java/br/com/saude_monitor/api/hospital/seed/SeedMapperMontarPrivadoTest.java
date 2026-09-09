package br.com.saude_monitor.api.hospital.seed;

import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import br.com.saude_monitor.api.hospital.service.GeofenceFactory;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cobre {@link SeedMapper#montarPrivado}, o pipeline JSON do CNES/DATASUS para hospitais
 * privados/filantrópicos do DF (fonte separada do DBF/SHP da rede pública — ver
 * {@code Documentos/07-dados/relatorio-importacao-CNES_PRIVADOS_20260908.md}).
 */
class SeedMapperMontarPrivadoTest {

    private static final SeedProperties PROPS = new SeedProperties(true, "data/", "UTF-8",
            "skip-if-not-empty", "TESTE", 0.05, 150, 100, 75, 100, 100, 100, 100);

    private final SeedMapper mapper = new SeedMapper(PROPS, new GeofenceFactory());

    private static EstabelecimentoPrivadoRecord registroValido(String tipo) {
        return new EstabelecimentoPrivadoRecord(
                "HOSPITAL AGUAS CLARAS", tipo, "49867",
                "R ARARIBA LOTE 03 E", "05", "AGUAS CLARAS", "71927360",
                -15.845841, -48.031202);
    }

    @Test
    void montaHospitalPrivadoComCamposNormalizados() {
        HospitalDocument doc = mapper.montarPrivado(registroValido("PRIVADO"));

        assertThat(doc).isNotNull();
        assertThat(doc.getNome()).isEqualTo("Hospital Aguas Claras");
        assertThat(doc.getTipo()).isEqualTo(TipoEstabelecimento.PRIVADO);
        assertThat(doc.getCategoria()).isEqualTo(CategoriaEstabelecimento.HOSPITAL);
        assertThat(doc.getCodigoCnes()).isEqualTo("0049867");
        assertThat(doc.getImportKey()).isNull(); // dedup por CNES, não por importKey
        assertThat(doc.getEndereco().getLogradouro()).isEqualTo("R Arariba Lote 03 E");
        assertThat(doc.getEndereco().getBairro()).isEqualTo("Aguas Claras");
        assertThat(doc.getEndereco().getCep()).isEqualTo("71927-360");
        assertThat(doc.getEndereco().getCidade()).isEqualTo("Brasília");
        assertThat(doc.getEndereco().getUf()).isEqualTo("DF");
        assertThat(doc.getLocalizacao().getCoordinates()).containsExactly(-48.031202, -15.845841);
        assertThat(doc.getGeofence()).isNotNull();
        assertThat(doc.isAtivo()).isTrue();
        assertThat(doc.getFonte()).isEqualTo("CNES_ESTABELECIMENTOS_PRIVADOS");
    }

    @Test
    void montaHospitalFilantropicoComTipoCorreto() {
        HospitalDocument doc = mapper.montarPrivado(registroValido("FILANTROPICO"));

        assertThat(doc).isNotNull();
        assertThat(doc.getTipo()).isEqualTo(TipoEstabelecimento.FILANTROPICO);
    }

    @Test
    void descartaRegistroComLatitudeNula() {
        EstabelecimentoPrivadoRecord registro = new EstabelecimentoPrivadoRecord(
                "HOSPITAL SEM COORDENADA", "PRIVADO", "49867",
                null, null, null, null, null, -48.031202);

        assertThat(mapper.montarPrivado(registro)).isNull();
    }

    @Test
    void descartaRegistroComLongitudeNula() {
        EstabelecimentoPrivadoRecord registro = new EstabelecimentoPrivadoRecord(
                "HOSPITAL SEM COORDENADA", "PRIVADO", "49867",
                null, null, null, null, -15.845841, null);

        assertThat(mapper.montarPrivado(registro)).isNull();
    }

    @Test
    void descartaRegistroComCoordenadaForaDoBboxDoDf() {
        EstabelecimentoPrivadoRecord registro = new EstabelecimentoPrivadoRecord(
                "HOSPITAL NO RIO", "PRIVADO", "49867",
                null, null, null, null, -22.90, -43.20);

        assertThat(mapper.montarPrivado(registro)).isNull();
    }

    @Test
    void descartaRegistroClassificadoComoPublico() {
        // Esta fonte é exclusiva de privados/filantrópicos — um registro público aqui
        // indicaria erro de classificação a montante, não algo para importar em silêncio.
        assertThat(mapper.montarPrivado(registroValido("PUBLICO"))).isNull();
    }

    @Test
    void descartaRegistroComTipoInvalido() {
        assertThat(mapper.montarPrivado(registroValido("DESCONHECIDO"))).isNull();
    }

    @Test
    void descartaRegistroSemCnes() {
        EstabelecimentoPrivadoRecord registro = new EstabelecimentoPrivadoRecord(
                "HOSPITAL SEM CNES", "PRIVADO", null,
                null, null, null, null, -15.845841, -48.031202);

        assertThat(mapper.montarPrivado(registro)).isNull();
    }

    @Test
    void descartaRegistroSemNomeAproveitavel() {
        EstabelecimentoPrivadoRecord registro = new EstabelecimentoPrivadoRecord(
                "   ", "PRIVADO", "49867",
                null, null, null, null, -15.845841, -48.031202);

        assertThat(mapper.montarPrivado(registro)).isNull();
    }
}
