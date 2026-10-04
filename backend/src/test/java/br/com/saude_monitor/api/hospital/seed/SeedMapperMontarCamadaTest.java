package br.com.saude_monitor.api.hospital.seed;

import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.service.GeofenceFactory;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cobre {@link SeedMapper#montar} nos campos SIM/NÃO da camada de UBS (sala de vacina,
 * farmácia e coleta de material): valor reconhecido vira {@code true}/{@code false} e valor
 * ausente ou ambíguo fica {@code null} no documento ("não informado"), sem NPE.
 */
class SeedMapperMontarCamadaTest {

    private static final SeedProperties PROPS = new SeedProperties(true, "data/", "UTF-8",
            "skip-if-not-empty", "TESTE", 0.05, 150, 100, 75, 100, 100, 100, 100);

    private static final double LON = -48.05;
    private static final double LAT = -15.80;

    private final SeedMapper mapper = new SeedMapper(PROPS, new GeofenceFactory());

    private static Map<String, String> linhaUbs(String salaVacina, String farmacia, String coleta) {
        Map<String, String> linha = new HashMap<>();
        linha.put("ubs", "UBS 1 CEILANDIA");
        linha.put("cnes", "49867");
        linha.put("ra", "CEILANDIA");
        linha.put("salavacin", salaVacina);
        linha.put("farmacia", farmacia);
        linha.put("colamater", coleta);
        return linha;
    }

    @Test
    void converteSimNaoReconhecidosEmBooleanos() {
        HospitalDocument doc = mapper.montar(CamadaEstabelecimento.UNIDADE_BASICA_SAUDE,
                linhaUbs("SIM", "NÃO", "s"), LON, LAT);

        assertThat(doc).isNotNull();
        assertThat(doc.getSalaVacina()).isTrue();
        assertThat(doc.getFarmacia()).isFalse();
        assertThat(doc.getColetaMaterial()).isTrue();
    }

    @Test
    void valorAusenteOuAmbiguoFicaNuloNoDocumento() {
        HospitalDocument doc = mapper.montar(CamadaEstabelecimento.UNIDADE_BASICA_SAUDE,
                linhaUbs("talvez", null, "   "), LON, LAT);

        assertThat(doc).isNotNull();
        assertThat(doc.getSalaVacina()).isNull();
        assertThat(doc.getFarmacia()).isNull();
        assertThat(doc.getColetaMaterial()).isNull();
    }

    @Test
    void camadaSemColunaSimNaoDeixaOsTresCamposNulos() {
        Map<String, String> linha = Map.of("hospitais", "HOSPITAL REGIONAL DE CEILANDIA", "ra", "CEILANDIA");

        HospitalDocument doc = mapper.montar(CamadaEstabelecimento.HOSPITAIS, linha, LON, LAT);

        assertThat(doc).isNotNull();
        assertThat(doc.getSalaVacina()).isNull();
        assertThat(doc.getFarmacia()).isNull();
        assertThat(doc.getColetaMaterial()).isNull();
    }
}
