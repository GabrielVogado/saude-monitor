package br.com.saude_monitor.api.hospital.seed;

import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Seed de estabelecimentos de saúde a partir de DBF (atributos) + SHP (geometria).
 *
 * <p>Executa no startup apenas quando {@code app.seed.enabled=true} (padrão). É
 * idempotente e seguro para qualquer ambiente/máquina:</p>
 *
 * <ul>
 *   <li><b>modo {@code skip-if-not-empty}</b> (padrão): semeia somente quando a coleção
 *       {@code hospitais} está vazia — cenário de "primeiro boot";</li>
 *   <li><b>modo {@code upsert}</b>: re-importa fazendo upsert por {@code codigoCnes} (ou
 *       {@code importKey} para registros sem CNES), preservando {@code id} e {@code criadoEm}.</li>
 * </ul>
 *
 * <p>As coordenadas (lat/lon) vêm exclusivamente do {@code .shp}; o {@code .dbf} carrega
 * apenas os atributos. O pareamento é por ORDEM de registro (1 DBF ⇄ 1 ponto SHP), mesmo
 * contrato do pipeline ETL de referência.</p>
 */
@Slf4j
@Component
@Order(SeedRunner.ORDEM)
@ConditionalOnProperty(prefix = "app.seed", name = "enabled", havingValue = "true")
@RequiredArgsConstructor
public class SeedRunner implements ApplicationRunner {

    /**
     * Primeiro entre os runners de dados: semear o banco vazio precede reconciliar o que
     * já existe ({@link ReconciliacaoRaioGeofenceRunner#ORDEM}). Sem ordem explícita, o
     * Spring executaria os dois na ordem de descoberta dos beans, e a reconciliação
     * poderia rodar num banco ainda vazio para depois o seed gravar por cima.
     */
    public static final int ORDEM = 10;

    private final DbfLeitor dbfLeitor;
    private final ShpPointLeitor shpPointLeitor;
    private final SeedMapper seedMapper;
    private final HospitalRepository hospitalRepository;
    private final SeedProperties properties;
    private final EstabelecimentoPrivadoLeitor estabelecimentoPrivadoLeitor;

    /** Nome do arquivo JSON com os hospitais privados/filantrópicos do CNES (ver {@code backend/data/README.md}). */
    static final String ARQUIVO_PRIVADOS = "estabelecimentos_privados.json";

    @Override
    public void run(ApplicationArguments args) {
        Path diretorio = Path.of(properties.path());
        if (!Files.isDirectory(diretorio)) {
            log.warn("[Seed] Diretório de dados não encontrado: {} — seed ignorado.",
                    diretorio.toAbsolutePath());
            return;
        }

        long existentes = hospitalRepository.count();
        if (existentes > 0 && !properties.upsert()) {
            log.info("[Seed] Coleção 'hospitais' já contém {} documento(s). "
                    + "Seed ignorado (modo=skip-if-not-empty). Use app.seed.modo=upsert para re-importar.",
                    existentes);
            return;
        }

        Charset charset = Charset.forName(properties.codepage());
        int novos = 0;
        int atualizados = 0;
        int descartados = 0;
        int camadasProcessadas = 0;

        try (var fluxo = Files.list(diretorio)) {
            for (Path shp : fluxo
                    .filter(p -> p.getFileName().toString().toLowerCase().endsWith(".shp"))
                    .sorted()
                    .toList()) {

                String stem = stemDe(shp);
                if (CamadaEstabelecimento.CAMADAS_IGNORADAS.contains(stem)) {
                    continue; // camadas de limite/região
                }
                Optional<CamadaEstabelecimento> camadaOpt = CamadaEstabelecimento.porStem(stem);
                if (camadaOpt.isEmpty()) {
                    log.warn("[Seed] Camada sem mapeamento, ignorada: {}", stem);
                    continue;
                }
                CamadaEstabelecimento camada = camadaOpt.get();

                Path dbf = diretorio.resolve(stem + ".dbf");
                if (!Files.isRegularFile(dbf)) {
                    log.warn("[Seed] DBF ausente para a camada {}, ignorada: {}", stem, dbf.getFileName());
                    continue;
                }

                List<Map<String, String>> linhas = dbfLeitor.ler(dbf, charset);
                List<double[]> pontos = shpPointLeitor.ler(shp);
                int total = Math.min(linhas.size(), pontos.size());

                int lidos = 0;
                for (int i = 0; i < total; i++) {
                    double[] ponto = pontos.get(i);
                    if (ponto == null) {
                        descartados++;
                        continue;
                    }
                    HospitalDocument doc = seedMapper.montar(camada, linhas.get(i), ponto[0], ponto[1]);
                    if (doc == null) {
                        descartados++;
                        continue;
                    }
                    lidos++;
                    boolean existia = salvarUpsert(doc);
                    if (existia) {
                        atualizados++;
                    } else {
                        novos++;
                    }
                }
                camadasProcessadas++;
                log.info("[Seed] Camada '{}': {} registro(s) lidos/gravados.", stem, lidos);
            }
        } catch (Exception e) {
            log.error("[Seed] Falha ao processar o diretório de dados.", e);
        }

        Path jsonPrivados = diretorio.resolve(ARQUIVO_PRIVADOS);
        if (Files.isRegularFile(jsonPrivados)) {
            try {
                List<EstabelecimentoPrivadoRecord> registros = estabelecimentoPrivadoLeitor.ler(jsonPrivados);
                int lidos = 0;
                for (EstabelecimentoPrivadoRecord registro : registros) {
                    HospitalDocument doc = seedMapper.montarPrivado(registro);
                    if (doc == null) {
                        descartados++;
                        continue;
                    }
                    // CNES é a única chave de dedup desta fonte (ver montarPrivado). Se já
                    // pertencer a um hospital PUBLICO existente (colisão de código — possível
                    // em dados CNES, ver o relatório de importação), não sobrescreve: um
                    // upsert normal trocaria o tipo do hospital público em silêncio.
                    Optional<HospitalDocument> existentePublico = hospitalRepository.findByCodigoCnes(doc.getCodigoCnes())
                            .filter(h -> h.getTipo() == TipoEstabelecimento.PUBLICO);
                    if (existentePublico.isPresent()) {
                        log.warn("[Seed] CNES {} já pertence ao hospital público '{}' — registro "
                                        + "privado/filantrópico ignorado (não reclassifica um hospital público existente).",
                                doc.getCodigoCnes(), existentePublico.get().getNome());
                        descartados++;
                        continue;
                    }
                    lidos++;
                    boolean existia = salvarUpsert(doc);
                    if (existia) {
                        atualizados++;
                    } else {
                        novos++;
                    }
                }
                log.info("[Seed] Arquivo '{}': {} registro(s) lidos/gravados.", jsonPrivados.getFileName(), lidos);
            } catch (Exception e) {
                log.error("[Seed] Falha ao processar {}.", jsonPrivados.getFileName(), e);
            }
        }

        log.info("[Seed] Concluído — camadas: {}, novos: {}, atualizados: {}, descartados: {}.",
                camadasProcessadas, novos, atualizados, descartados);
    }

    /** Upsert idempotente por {@code codigoCnes} (primário) ou {@code importKey} (fallback). */
    private boolean salvarUpsert(HospitalDocument doc) {
        Optional<HospitalDocument> existente = buscarExistente(doc);
        if (existente.isPresent()) {
            // Preserva o identificador e a data de criação originais.
            doc.setId(existente.get().getId());
            doc.setCriadoEm(existente.get().getCriadoEm());
        }
        try {
            hospitalRepository.save(doc);
        } catch (org.springframework.dao.DuplicateKeyException e) {
            // Corrida de concorrência: chave única já existente — ignora sem interromper.
            log.warn("[Seed] Registro ignorado por chave duplicada: {}", doc.getNome());
            return existente.isPresent();
        }
        return existente.isPresent();
    }

    private Optional<HospitalDocument> buscarExistente(HospitalDocument doc) {
        if (doc.getCodigoCnes() != null) {
            return hospitalRepository.findByCodigoCnes(doc.getCodigoCnes());
        }
        if (doc.getImportKey() != null) {
            return hospitalRepository.findByImportKey(doc.getImportKey());
        }
        return Optional.empty();
    }

    private String stemDe(Path arquivo) {
        String nome = arquivo.getFileName().toString();
        return nome.substring(0, nome.length() - 4); // remove ".shp"
    }
}
