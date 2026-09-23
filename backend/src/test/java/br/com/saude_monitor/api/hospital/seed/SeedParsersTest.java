package br.com.saude_monitor.api.hospital.seed;

import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import br.com.saude_monitor.api.hospital.service.GeofenceFactory;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Valida os parsers do seed lendo os arquivos reais de {@code backend/data/}.
 *
 * <p>O ponto mais sensível é o {@link ShpPointLeitor} (parsing binário little-endian feito
 * à mão): se a ordem dos bytes estiver errada, as coordenadas saem fora do bounding box do DF.</p>
 */
class SeedParsersTest {

    private static final Path DATA = Path.of("data");

    private static final double LAT_MIN = -16.20, LAT_MAX = -15.40;
    private static final double LON_MIN = -48.30, LON_MAX = -47.30;

    private final DbfLeitor dbfLeitor = new DbfLeitor();
    private final ShpPointLeitor shpPointLeitor = new ShpPointLeitor();

    @Test
    void lePontosDosHospitaisComCoordenadasCorretas() {
        List<double[]> pontos = shpPointLeitor.ler(DATA.resolve("Hospitais.shp"));

        assertThat(pontos).hasSize(16);

        // HOSPITAL REGIONAL DE CEILANDIA — localizacao conhecida no banco [-48.0963, -15.8154].
        assertThat(pontos).anySatisfy(p ->
                assertThat(p[0]).isEqualTo(-48.0963, within(1e-3)));

        // Todas as coordenadas devem cair dentro do bbox do DF (valida o little-endian).
        for (double[] p : pontos) {
            assertThat(p[1]).isBetween(LAT_MIN - 0.05, LAT_MAX + 0.05);
            assertThat(p[0]).isBetween(LON_MIN - 0.05, LON_MAX + 0.05);
        }
    }

    @Test
    void leAtributosDosHospitais() {
        List<Map<String, String>> linhas = dbfLeitor.ler(
                DATA.resolve("Hospitais.dbf"), StandardCharsets.UTF_8);

        assertThat(linhas).hasSize(16);
        assertThat(linhas.get(0)).containsKey("hospitais");
        assertThat(linhas.get(0).get("hospitais")).isNotBlank();
    }

    @Test
    void montaHospitalComCategoriaGeofenceEImportKey() {
        SeedProperties props = new SeedProperties(true, "data/", "UTF-8", "skip-if-not-empty",
                "TESTE", 0.05, 200, 150, 100, 150, 150, 150, 150);
        SeedMapper mapper = new SeedMapper(props, new GeofenceFactory());

        List<Map<String, String>> linhas = dbfLeitor.ler(
                DATA.resolve("Hospitais.dbf"), StandardCharsets.UTF_8);
        List<double[]> pontos = shpPointLeitor.ler(DATA.resolve("Hospitais.shp"));

        HospitalDocument doc = mapper.montar(
                CamadaEstabelecimento.HOSPITAIS, linhas.get(0), pontos.get(0)[0], pontos.get(0)[1]);

        assertThat(doc).isNotNull();
        assertThat(doc.getCategoria()).isEqualTo(CategoriaEstabelecimento.HOSPITAL);
        assertThat(doc.getTipo()).isEqualTo(TipoEstabelecimento.PUBLICO);
        assertThat(doc.getEndereco().getCidade()).isEqualTo("Brasília");
        assertThat(doc.getEndereco().getUf()).isEqualTo("DF");

        // Sem CNES na fonte → importKey sha256 (64 hex).
        assertThat(doc.getCodigoCnes()).isNull();
        assertThat(doc.getImportKey()).hasSize(64);

        // Localização e geofence derivados das coordenadas.
        assertThat(doc.getLocalizacao().getCoordinates().get(1))
                .isEqualTo(pontos.get(0)[1], within(1e-9));
        assertThat(doc.getGeofence()).isNotNull();
        assertThat(doc.getGeofence().getCoordinates().get(0).getCoordinates()).hasSize(33); // 32 + fechamento
    }
}
