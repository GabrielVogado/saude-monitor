package br.com.saude_monitor.api.hospital.seed;

import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import br.com.saude_monitor.api.hospital.service.GeofenceFactory;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cobre {@link SeedMapper#montarPublicoComplementar}, o pipeline JSON do CNES/DATASUS
 * para hospitais PÚBLICOS do DF ausentes da fonte InfoSaúde/GDF (ver
 * {@code Documentos/07-dados/relatorio-importacao-CNES_PUBLICOS_COMPLEMENTARES_20260909.md}).
 *
 * <p>Fonte exclusiva de hospitais públicos — o {@code tipo} não vem do registro (não
 * existe esse campo em {@link HospitalPublicoComplementarRecord}), é sempre
 * {@link TipoEstabelecimento#PUBLICO}, fixo no código.</p>
 */
class SeedMapperMontarPublicoComplementarTest {

    private static final SeedProperties PROPS = new SeedProperties(true, "data/", "UTF-8",
            "skip-if-not-empty", "TESTE", 0.05, 150, 100, 75, 100, 100, 100, 100);

    private final SeedMapper mapper = new SeedMapper(PROPS, new GeofenceFactory());

    private static HospitalPublicoComplementarRecord registroValido() {
        return new HospitalPublicoComplementarRecord(
                "INSTITUTO DE CARDIOLOGIA E TRANSPLANTES DO DISTRITO FEDERAL", "3276678",
                "ST SUDOESTE CRUZEIRO SUDOESTE OCTOGONAL", "S/N", "CRUZEIRO NOVO", "70675731",
                -15.801428, -47.935961);
    }

    @Test
    void montaHospitalPublicoComplementarComCamposNormalizadosETipoSempreFixo() {
        HospitalDocument doc = mapper.montarPublicoComplementar(registroValido());

        assertThat(doc).isNotNull();
        assertThat(doc.getNome()).isEqualTo("Instituto de Cardiologia e Transplantes do Distrito Federal");
        assertThat(doc.getTipo()).isEqualTo(TipoEstabelecimento.PUBLICO);
        assertThat(doc.getCategoria()).isEqualTo(CategoriaEstabelecimento.HOSPITAL);
        assertThat(doc.getCodigoCnes()).isEqualTo("3276678");
        assertThat(doc.getImportKey()).isNull(); // dedup por CNES, não por importKey
        assertThat(doc.getEndereco().getBairro()).isEqualTo("Cruzeiro Novo");
        assertThat(doc.getEndereco().getCep()).isEqualTo("70675-731");
        assertThat(doc.getEndereco().getCidade()).isEqualTo("Brasília");
        assertThat(doc.getEndereco().getUf()).isEqualTo("DF");
        assertThat(doc.getLocalizacao().getCoordinates()).containsExactly(-47.935961, -15.801428);
        assertThat(doc.getGeofence()).isNotNull();
        assertThat(doc.isAtivo()).isTrue();
        assertThat(doc.getFonte()).isEqualTo("CNES_HOSPITAIS_PUBLICOS_COMPLEMENTARES");
    }

    @Test
    void descartaRegistroComLatitudeNula() {
        HospitalPublicoComplementarRecord registro = new HospitalPublicoComplementarRecord(
                "HOSPITAL SEM COORDENADA", "3276678",
                null, null, null, null, null, -47.935961);

        assertThat(mapper.montarPublicoComplementar(registro)).isNull();
    }

    @Test
    void descartaRegistroComLongitudeNula() {
        HospitalPublicoComplementarRecord registro = new HospitalPublicoComplementarRecord(
                "HOSPITAL SEM COORDENADA", "3276678",
                null, null, null, null, -15.801428, null);

        assertThat(mapper.montarPublicoComplementar(registro)).isNull();
    }

    @Test
    void descartaRegistroComCoordenadaForaDoBboxDoDf() {
        HospitalPublicoComplementarRecord registro = new HospitalPublicoComplementarRecord(
                "HOSPITAL NO RIO", "3276678",
                null, null, null, null, -22.90, -43.20);

        assertThat(mapper.montarPublicoComplementar(registro)).isNull();
    }

    @Test
    void descartaRegistroSemCnes() {
        HospitalPublicoComplementarRecord registro = new HospitalPublicoComplementarRecord(
                "HOSPITAL SEM CNES", null,
                null, null, null, null, -15.801428, -47.935961);

        assertThat(mapper.montarPublicoComplementar(registro)).isNull();
    }

    @Test
    void descartaRegistroSemNomeAproveitavel() {
        HospitalPublicoComplementarRecord registro = new HospitalPublicoComplementarRecord(
                "   ", "3276678",
                null, null, null, null, -15.801428, -47.935961);

        assertThat(mapper.montarPublicoComplementar(registro)).isNull();
    }
}
