package br.com.saude_monitor.api.hospital.seed;

import br.com.saude_monitor.api.hospital.document.HospitalDocument;
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
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

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
    private final HospitalPublicoComplementarLeitor hospitalPublicoComplementarLeitor;

    /**
     * Nome do arquivo JSON com hospitais PÚBLICOS do CNES ausentes da fonte InfoSaúde/GDF
     * (ver {@code backend/data/README.md}). Fonte exclusiva de hospitais públicos — ver
     * {@link SeedMapper#montarPublicoComplementar}.
     */
    static final String ARQUIVO_PUBLICOS_COMPLEMENTARES = "hospitais_publicos_complementares.json";

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
        int gemeosIgnorados = 0;
        int camadasProcessadas = 0;

        // Fase 1 — monta todos os documentos em memória, sem gravar. A ordem é
        // determinística (camadas em ordem alfabética, linhas em ordem) para logs
        // e testes reproduzíveis.
        List<DocPendente> pendentes = new ArrayList<>();
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
                    pendentes.add(new DocPendente(doc, stem));
                }
                camadasProcessadas++;
                log.info("[Seed] Camada '{}': {} registro(s) montados.", stem, lidos);
            }
        } catch (Exception e) {
            log.error("[Seed] Falha ao processar o diretório de dados.", e);
        }

        Path jsonPublicosComplementares = diretorio.resolve(ARQUIVO_PUBLICOS_COMPLEMENTARES);
        if (Files.isRegularFile(jsonPublicosComplementares)) {
            try {
                List<HospitalPublicoComplementarRecord> registros =
                        hospitalPublicoComplementarLeitor.ler(jsonPublicosComplementares);
                int lidos = 0;
                for (HospitalPublicoComplementarRecord registro : registros) {
                    HospitalDocument doc = seedMapper.montarPublicoComplementar(registro);
                    if (doc == null) {
                        descartados++;
                        continue;
                    }
                    lidos++;
                    pendentes.add(new DocPendente(doc, jsonPublicosComplementares.getFileName().toString()));
                }
                log.info("[Seed] Arquivo '{}': {} registro(s) montados.",
                        jsonPublicosComplementares.getFileName(), lidos);
            } catch (Exception e) {
                log.error("[Seed] Falha ao processar {}.", jsonPublicosComplementares.getFileName(), e);
            }
        }

        // Fase 2a — documentos COM CNES primeiro (versão autoritativa: coordenadas e
        // atributos completos), registrando a chave de gêmeo de cada um.
        Set<String> chavesCnes = new HashSet<>();
        for (DocPendente pendente : pendentes) {
            if (pendente.doc().getCodigoCnes() == null) {
                continue;
            }
            chavesCnes.add(chaveGemea(pendente.doc()));
            switch (salvarUpsert(pendente.doc())) {
                case NOVO -> novos++;
                case ATUALIZADO -> atualizados++;
                case IGNORADO_TIPO_DIVERGENTE -> descartados++;
            }
        }

        // Fase 2b — documentos SEM CNES, exceto gêmeos de um CNES já importado nesta
        // execução. É o caso das camadas sem coluna CNES (ex.: UBS Indígena/Rua) que
        // repetem unidades da camada principal com coordenadas ligeiramente
        // diferentes: sem este filtro, cada versão vira um documento (círculos
        // amontoados no mapa — auditoria em `07-dados/relatorio-auditoria-duplicatas-coordenadas-20260912.md`).
        // Unidades sem gêmeo CNES (ex.: prisionais com nome sintético) passam — pontos
        // distintos com o mesmo nome são preservados, não fundidos.
        for (DocPendente pendente : pendentes) {
            if (pendente.doc().getCodigoCnes() != null) {
                continue;
            }
            if (chavesCnes.contains(chaveGemea(pendente.doc()))) {
                gemeosIgnorados++;
                log.info("[Seed] Gêmeo sem CNES ignorado (versão CNES importada): {} [{}].",
                        pendente.doc().getNome(), pendente.origem());
                continue;
            }
            switch (salvarUpsert(pendente.doc())) {
                case NOVO -> novos++;
                case ATUALIZADO -> atualizados++;
                case IGNORADO_TIPO_DIVERGENTE -> descartados++;
            }
        }

        log.info("[Seed] Concluído — camadas: {}, novos: {}, atualizados: {}, descartados: {}, gêmeos ignorados: {}.",
                camadasProcessadas, novos, atualizados, descartados, gemeosIgnorados);
    }

    /** Documento montado aguardando gravação, com a origem para log. */
    private record DocPendente(HospitalDocument doc, String origem) {
    }

    /**
     * Chave de gêmeo entre camadas: {@code categoria|nome canônico|bairro canônico}.
     * O bairro (RA nas camadas de UBS) impede fundir homônimos de regiões distintas;
     * unidades sem gêmeo CNES nunca colidem aqui — a regra só filtra quando a chave
     * já foi registrada por um documento COM CNES na fase 2a.
     */
    private static String chaveGemea(HospitalDocument doc) {
        String bairro = doc.getEndereco() != null && doc.getEndereco().getBairro() != null
                ? doc.getEndereco().getBairro()
                : "";
        return doc.getCategoria().name() + "|"
                + EstabelecimentoNormalizador.canonicalizar(doc.getNome()) + "|"
                + EstabelecimentoNormalizador.canonicalizar(bairro);
    }

    /** Resultado de {@link #salvarUpsert}, distinto de um simples booleano para poder
     * contabilizar separadamente o caso em que o upsert foi recusado. */
    private enum ResultadoUpsert { NOVO, ATUALIZADO, IGNORADO_TIPO_DIVERGENTE }

    /**
     * Upsert idempotente por {@code codigoCnes} (primário) ou {@code importKey} (fallback).
     *
     * <p>Recusa o upsert quando o documento existente tem um {@code tipo} diferente do
     * documento novo — uma colisão de chave entre fontes/pipelines diferentes com tipo
     * divergente nunca é esperada (hoje os dois pipelines só produzem PUBLICO), e
     * sobrescrever reclassificaria o hospital em silêncio. Generalização de uma proteção
     * que existia só no ponto de entrada de uma fonte específica (código-review do PR
     * #103) — vale para qualquer pipeline futuro que reutilize este método, não só para
     * o que a motivou originalmente.</p>
     */
    private ResultadoUpsert salvarUpsert(HospitalDocument doc) {
        Optional<HospitalDocument> existente = buscarExistente(doc);
        if (existente.isPresent()) {
            HospitalDocument atual = existente.get();
            if (atual.getTipo() != doc.getTipo()) {
                log.warn("[Seed] '{}' já existe como {}, mas o registro novo é {} — upsert "
                                + "recusado para não reclassificar em silêncio.",
                        atual.getNome(), atual.getTipo(), doc.getTipo());
                return ResultadoUpsert.IGNORADO_TIPO_DIVERGENTE;
            }
            // Preserva o identificador e a data de criação originais.
            doc.setId(atual.getId());
            doc.setCriadoEm(atual.getCriadoEm());
        }
        try {
            hospitalRepository.save(doc);
        } catch (org.springframework.dao.DuplicateKeyException e) {
            // Corrida de concorrência: chave única já existente — ignora sem interromper.
            log.warn("[Seed] Registro ignorado por chave duplicada: {}", doc.getNome());
            return existente.isPresent() ? ResultadoUpsert.ATUALIZADO : ResultadoUpsert.NOVO;
        }
        return existente.isPresent() ? ResultadoUpsert.ATUALIZADO : ResultadoUpsert.NOVO;
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
