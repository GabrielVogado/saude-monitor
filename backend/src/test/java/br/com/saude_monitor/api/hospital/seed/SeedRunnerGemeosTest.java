package br.com.saude_monitor.api.hospital.seed;

import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.hospital.service.GeofenceFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Dedup entre camadas no {@link SeedRunner} (auditoria de duplicatas, 12/09/2026).
 *
 * <p>Causa provada no banco de dev: a mesma unidade existe na camada principal (COM
 * CNES) e nas camadas sem coluna CNES (Indígena/Rua, com coordenadas ligeiramente
 * diferentes). Como o upsert é por CNES <em>ou</em> por {@code importKey} (que inclui
 * as coordenadas), as duas versões viravam documentos — círculos amontoados no mapa.
 * O runner agora importa os CNES primeiro e ignora o sem-CNEs gêmeo.</p>
 */
class SeedRunnerGemeosTest {

    private final HospitalRepository hospitalRepository = mock(HospitalRepository.class);

    private SeedRunner runner(Path dataDir) {
        SeedProperties properties = new SeedProperties(true, dataDir.toString(), "UTF-8", "skip-if-not-empty",
                "TESTE", 0.05, 150, 100, 75, 100, 100, 100, 100);
        SeedMapper seedMapper = new SeedMapper(properties, new GeofenceFactory());
        return new SeedRunner(new DbfLeitor(), new ShpPointLeitor(), seedMapper,
                hospitalRepository, properties, mock(HospitalPublicoComplementarLeitor.class));
    }

    @Test
    void ignoraVersaoSemCnesQuandoGemeoComCnesExisteNaMesmaExecucao(@TempDir Path dataDir) throws Exception {
        // Camada principal (com CNES) + camada Indígena (sem CNES) com a MESMA unidade
        // em pontos ~20 m apart — o retrato exato do banco de dev ("Ubs 1" ×2).
        camada(dataDir, "Unidade_Básica_de_Saúde",
                List.of("ubs", "cnes", "endereco", "cep", "ra"),
                List.of(List.of("UBS GEMEOS TESTE", "7654321", "RUA A", "70000000", "GAMA")),
                List.of(new double[]{-47.9000, -15.8000}));
        camada(dataDir, "UBS_-_Saúde_Indígena",
                List.of("ubsindig", "endereco", "cep", "ra"),
                List.of(List.of("UBS GEMEOS TESTE", "RUA A", "70000000", "GAMA")),
                List.of(new double[]{-47.9002, -15.8002}));

        when(hospitalRepository.count()).thenReturn(0L);
        when(hospitalRepository.findByCodigoCnes(any())).thenReturn(Optional.empty());
        when(hospitalRepository.findByImportKey(any())).thenReturn(Optional.empty());

        runner(dataDir).run(null);

        // UMA gravação, e a versão autoritativa (com CNES).
        ArgumentCaptor<HospitalDocument> captor = ArgumentCaptor.forClass(HospitalDocument.class);
        verify(hospitalRepository, times(1)).save(captor.capture());
        assertThat(captor.getValue().getCodigoCnes()).isEqualTo("7654321");
    }

    @Test
    void preservaPontosDistintosSemCnesMesmoComMesmoNome(@TempDir Path dataDir) throws Exception {
        // Camada sem coluna de nome (Prisionais): 2 registros viram "Ubs Gama" nos
        // mesmos ~100 m — pontos distintos NÃO são fundidos (podem ser unidades
        // distintas do complexo; fundir seria perda de dado).
        camada(dataDir, "UBS_-_Unidades_Prisionais",
                List.of("endereco", "cep", "ra"),
                List.of(
                        List.of("COMPLEXO A", "70000001", "GAMA"),
                        List.of("COMPLEXO A", "70000001", "GAMA")),
                List.of(new double[]{-47.9000, -15.8000}, new double[]{-47.9010, -15.8010}));

        when(hospitalRepository.count()).thenReturn(0L);
        when(hospitalRepository.findByCodigoCnes(any())).thenReturn(Optional.empty());
        when(hospitalRepository.findByImportKey(any())).thenReturn(Optional.empty());

        runner(dataDir).run(null);

        verify(hospitalRepository, times(2)).save(any(HospitalDocument.class));
    }

    @Test
    void naoFundeHomonimosDeRegioesDistintas(@TempDir Path dataDir) throws Exception {
        // Mesmo nome canônico em RAs diferentes + CNES só de um lado: a chave de
        // gêmeo inclui o bairro (RA), então o sem-CNEs da outra RA sobrevive.
        camada(dataDir, "Unidade_Básica_de_Saúde",
                List.of("ubs", "cnes", "endereco", "cep", "ra"),
                List.of(List.of("UBS X", "7654321", "RUA A", "70000000", "GAMA")),
                List.of(new double[]{-47.9000, -15.8000}));
        camada(dataDir, "UBS_-_Saúde_Indígena",
                List.of("ubsindig", "endereco", "cep", "ra"),
                List.of(List.of("UBS X", "RUA B", "70000000", "CEILANDIA")),
                List.of(new double[]{-48.1000, -15.8100}));

        when(hospitalRepository.count()).thenReturn(0L);
        when(hospitalRepository.findByCodigoCnes(any())).thenReturn(Optional.empty());
        when(hospitalRepository.findByImportKey(any())).thenReturn(Optional.empty());

        runner(dataDir).run(null);

        verify(hospitalRepository, times(2)).save(any(HospitalDocument.class));
    }

    // ------------------------------------------------------------------
    // Fixtures mínimos de shapefile (.shp Point + .dbf dBase III)
    // ------------------------------------------------------------------

    private static void camada(Path dir, String stem, List<String> campos,
                               List<List<String>> linhas, List<double[]> pontos) throws Exception {
        escreverShp(dir.resolve(stem + ".shp"), pontos);
        escreverDbf(dir.resolve(stem + ".dbf"), campos, linhas);
    }

    private static void escreverShp(Path arquivo, List<double[]> pontos) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ByteBuffer h = ByteBuffer.allocate(100).order(ByteOrder.BIG_ENDIAN);
        h.putInt(9994);
        h.put(new byte[20]);
        h.putInt(50 + pontos.size() * 14);
        h.order(ByteOrder.LITTLE_ENDIAN);
        h.putInt(1000).putInt(1);
        h.putDouble(-48.3).putDouble(-47.3).putDouble(-16.1).putDouble(-15.5);
        h.putDouble(0).putDouble(0).putDouble(0).putDouble(0);
        out.write(h.array());
        int n = 1;
        for (double[] p : pontos) {
            ByteBuffer r = ByteBuffer.allocate(8).order(ByteOrder.BIG_ENDIAN);
            r.putInt(n++).putInt(10);
            out.write(r.array());
            ByteBuffer c = ByteBuffer.allocate(20).order(ByteOrder.LITTLE_ENDIAN);
            c.putInt(1).putDouble(p[0]).putDouble(p[1]);
            out.write(c.array());
        }
        Files.write(arquivo, out.toByteArray());
    }

    private static void escreverDbf(Path arquivo, List<String> campos, List<List<String>> linhas) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int larguras = campos.stream().mapToInt(c -> 60).sum();
        int headerLen = 32 + campos.size() * 32 + 1;
        int recordLen = 1 + larguras;
        ByteBuffer h = ByteBuffer.allocate(32).order(ByteOrder.LITTLE_ENDIAN);
        h.put((byte) 0x03).put((byte) 126).put((byte) 9).put((byte) 12);
        h.putInt(linhas.size()).putShort((short) headerLen).putShort((short) recordLen);
        h.put(new byte[20]);
        out.write(h.array());
        for (String campo : campos) {
            byte[] nome = new byte[11];
            byte[] raw = campo.getBytes(StandardCharsets.US_ASCII);
            System.arraycopy(raw, 0, nome, 0, Math.min(raw.length, 10));
            out.write(nome);
            out.write('C');
            out.write(new byte[4]);
            out.write(60);
            out.write(0);
            out.write(new byte[14]);
        }
        out.write(0x0D);
        for (List<String> linha : linhas) {
            out.write(0x20);
            for (int i = 0; i < campos.size(); i++) {
                String valor = i < linha.size() ? linha.get(i) : "";
                byte[] raw = valor.getBytes(StandardCharsets.UTF_8);
                byte[] celula = new byte[60];
                java.util.Arrays.fill(celula, (byte) ' ');
                System.arraycopy(raw, 0, celula, 0, Math.min(raw.length, 60));
                out.write(celula);
            }
        }
        Files.write(arquivo, out.toByteArray());
    }
}
