package br.com.saude_monitor.api.hospital.seed;

import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

/**
 * Cobre o trecho do {@link SeedRunner} que processa {@code estabelecimentos_privados.json}
 * (fonte CNES para hospitais privados/filantrópicos), em especial a proteção contra
 * colisão de CNES com um hospital PUBLICO já existente (code-review high, achado #1:
 * um upsert normal reclassificaria o hospital público em silêncio).
 */
class SeedRunnerPrivadosTest {

    private static final String JSON_VALIDO = """
            [
              {
                "nome": "HOSPITAL TESTE PRIVADO",
                "tipo": "PRIVADO",
                "codigoCnes": "1234567",
                "logradouro": "QNM 16",
                "numero": "07",
                "bairro": "CEILANDIA",
                "cep": "72215100",
                "latitude": -15.82,
                "longitude": -48.10
              }
            ]
            """;

    private final HospitalRepository hospitalRepository = mock(HospitalRepository.class);

    private SeedRunner runner(Path dataDir, String modo) {
        SeedProperties properties = new SeedProperties(true, dataDir.toString(), "UTF-8", modo,
                "TESTE", 0.05, 150, 100, 75, 100, 100, 100, 100);
        SeedMapper seedMapper = new SeedMapper(properties, new GeofenceFactory());
        return new SeedRunner(new DbfLeitor(), new ShpPointLeitor(), seedMapper,
                hospitalRepository, properties, new EstabelecimentoPrivadoLeitor());
    }

    @Test
    void importaHospitalPrivadoNovoQuandoNaoHaColisaoDeCnes(@TempDir Path dataDir) throws Exception {
        Files.writeString(dataDir.resolve(SeedRunner.ARQUIVO_PRIVADOS), JSON_VALIDO);
        when(hospitalRepository.count()).thenReturn(0L);
        when(hospitalRepository.findByCodigoCnes(eq("1234567"))).thenReturn(Optional.empty());

        runner(dataDir, "skip-if-not-empty").run(null);

        verify(hospitalRepository).save(any(HospitalDocument.class));
    }

    @Test
    void naoSobrescreveHospitalPublicoExistenteComMesmoCnes(@TempDir Path dataDir) throws Exception {
        Files.writeString(dataDir.resolve(SeedRunner.ARQUIVO_PRIVADOS), JSON_VALIDO);

        HospitalDocument publicoExistente = HospitalDocument.builder()
                .id("h-existente")
                .nome("Hospital Regional Já Cadastrado")
                .tipo(TipoEstabelecimento.PUBLICO)
                .categoria(CategoriaEstabelecimento.HOSPITAL)
                .codigoCnes("1234567")
                .ativo(true)
                .build();

        when(hospitalRepository.count()).thenReturn(1L);
        when(hospitalRepository.findByCodigoCnes(eq("1234567"))).thenReturn(Optional.of(publicoExistente));

        // modo upsert: só assim o runner processa com a coleção não-vazia.
        runner(dataDir, "upsert").run(null);

        // O registro privado com CNES colidente NUNCA é gravado — o hospital público
        // existente não pode ser silenciosamente reclassificado como privado.
        verify(hospitalRepository, never()).save(any(HospitalDocument.class));
    }

    @Test
    void importaNormalmenteQuandoOCnesColideComUmPrivadoOuFilantropicoExistente(@TempDir Path dataDir)
            throws Exception {
        Files.writeString(dataDir.resolve(SeedRunner.ARQUIVO_PRIVADOS), JSON_VALIDO);

        HospitalDocument privadoExistente = HospitalDocument.builder()
                .id("h-existente")
                .nome("Hospital Teste Privado (versão antiga)")
                .tipo(TipoEstabelecimento.PRIVADO)
                .categoria(CategoriaEstabelecimento.HOSPITAL)
                .codigoCnes("1234567")
                .ativo(true)
                .build();

        when(hospitalRepository.count()).thenReturn(1L);
        when(hospitalRepository.findByCodigoCnes(eq("1234567"))).thenReturn(Optional.of(privadoExistente));

        // Re-importação normal de um registro já privado: deve fazer upsert (atualizar), não pular.
        runner(dataDir, "upsert").run(null);

        verify(hospitalRepository).save(any(HospitalDocument.class));
    }
}
