package br.com.saude_monitor.api.hospital.seed;

import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.hospital.service.GeofenceFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Cobre o trecho do {@link SeedRunner} que processa
 * {@code hospitais_publicos_complementares.json} (fonte CNES para hospitais públicos
 * ausentes da rede InfoSaúde/GDF).
 */
class SeedRunnerPublicoComplementarTest {

    private static final String JSON_VALIDO = """
            [
              {
                "nome": "INSTITUTO DE CARDIOLOGIA E TRANSPLANTES DO DISTRITO FEDERAL",
                "codigoCnes": "3276678",
                "logradouro": "ST SUDOESTE CRUZEIRO SUDOESTE OCTOGONAL",
                "numero": "S/N",
                "bairro": "CRUZEIRO NOVO",
                "cep": "70675731",
                "latitude": -15.801428,
                "longitude": -47.935961
              }
            ]
            """;

    private final HospitalRepository hospitalRepository = mock(HospitalRepository.class);

    private SeedRunner runner(Path dataDir, String modo) {
        SeedProperties properties = new SeedProperties(true, dataDir.toString(), "UTF-8", modo,
                "TESTE", 0.05, 150, 100, 75, 100, 100, 100, 100);
        SeedMapper seedMapper = new SeedMapper(properties, new GeofenceFactory());
        return new SeedRunner(new DbfLeitor(), new ShpPointLeitor(), seedMapper,
                hospitalRepository, properties, new HospitalPublicoComplementarLeitor());
    }

    @Test
    void importaHospitalPublicoNovoQuandoNaoExisteNaBase(@TempDir Path dataDir) throws Exception {
        Files.writeString(dataDir.resolve(SeedRunner.ARQUIVO_PUBLICOS_COMPLEMENTARES), JSON_VALIDO);
        when(hospitalRepository.count()).thenReturn(0L);
        when(hospitalRepository.findByCodigoCnes(eq("3276678"))).thenReturn(Optional.empty());

        runner(dataDir, "skip-if-not-empty").run(null);

        verify(hospitalRepository).save(any(HospitalDocument.class));
    }

    @Test
    void reimportacaoEmModoUpsertAtualizaOMesmoRegistroSemDuplicar(@TempDir Path dataDir) throws Exception {
        Files.writeString(dataDir.resolve(SeedRunner.ARQUIVO_PUBLICOS_COMPLEMENTARES), JSON_VALIDO);

        HospitalDocument jaImportado = HospitalDocument.builder()
                .id("h-existente")
                .nome("Instituto de Cardiologia e Transplantes do Distrito Federal")
                .codigoCnes("3276678")
                .ativo(true)
                .build();

        when(hospitalRepository.count()).thenReturn(341L);
        when(hospitalRepository.findByCodigoCnes(eq("3276678"))).thenReturn(Optional.of(jaImportado));

        runner(dataDir, "upsert").run(null);

        verify(hospitalRepository).save(any(HospitalDocument.class));
    }

    @Test
    void naoProcessaArquivoAusente(@TempDir Path dataDir) {
        when(hospitalRepository.count()).thenReturn(0L);

        runner(dataDir, "skip-if-not-empty").run(null);

        verify(hospitalRepository, org.mockito.Mockito.never()).save(any(HospitalDocument.class));
    }
}
