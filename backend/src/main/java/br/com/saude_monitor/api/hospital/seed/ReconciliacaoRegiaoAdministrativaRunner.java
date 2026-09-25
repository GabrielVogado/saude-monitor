package br.com.saude_monitor.api.hospital.seed;

import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.regiao.service.RegiaoAdministrativaResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;

/**
 * Preenche, no startup, o campo {@code regiaoAdministrativa} dos hospitais que ainda não
 * o têm (E7-03, filtro por região do Painel Admin).
 *
 * <p><b>Por que existe:</b> o campo é novo; os 340 estabelecimentos já gravados (seed +
 * importação CNES) nasceram sem ele, e o {@link SeedRunner} roda em
 * {@code skip-if-not-empty} — não regrava banco não vazio. Sem este reconciliador, o
 * filtro por região do painel ficaria sempre vazio para todo mundo que já existia antes
 * desta estória.</p>
 *
 * <p><b>O que ele não faz:</b> não recalcula quem já tem o campo preenchido — mesmo que a
 * camada de RAs mude entre deploys (evento raro; divisão administrativa quase não muda).
 * Reprocessar uma mudança de camada é uma migração deliberada, não um efeito colateral do
 * boot. Cadastro/edição pelo admin (E1-01/E7-06) recalculam o campo sempre, na escrita —
 * ver {@code HospitalServiceImpl}.</p>
 *
 * <p><b>Idempotente:</b> na segunda execução não sobra hospital com o campo vazio (exceto
 * os cujo centroide caia fora de toda RA mapeada, ou sem localização) e nada é gravado.</p>
 */
@Slf4j
@Component
@Order(ReconciliacaoRegiaoAdministrativaRunner.ORDEM)
@ConditionalOnProperty(prefix = "app.regiao-administrativa.reconciliacao", name = "enabled", havingValue = "true")
@RequiredArgsConstructor
public class ReconciliacaoRegiaoAdministrativaRunner implements ApplicationRunner {

    /** Depois da reconciliação de raio ({@link ReconciliacaoRaioGeofenceRunner#ORDEM}). */
    public static final int ORDEM = 30;

    private static final int TAMANHO_PAGINA = 200;

    private final HospitalRepository hospitalRepository;
    private final RegiaoAdministrativaResolver resolver;
    private final MongoTemplate mongoTemplate;

    @Override
    public void run(ApplicationArguments args) {
        int preenchidos = 0;
        int foraDeTodaRegiao = 0;
        int semLocalizacao = 0;
        int total = 0;

        Pageable pagina = PageRequest.of(0, TAMANHO_PAGINA, Sort.by(Sort.Direction.ASC, "id"));
        Page<HospitalDocument> page;

        do {
            page = hospitalRepository.findAll(pagina);
            BulkOperations bulkOps = mongoTemplate.bulkOps(BulkOperations.BulkMode.UNORDERED, HospitalDocument.class);
            int naPagina = 0;

            for (HospitalDocument hospital : page.getContent()) {
                total++;
                if (hospital.getRegiaoAdministrativa() != null && !hospital.getRegiaoAdministrativa().isBlank()) {
                    continue; // já preenchido — não recalcula (ver Javadoc da classe)
                }
                GeoJsonPoint centro = hospital.getLocalizacao();
                if (centro == null) {
                    semLocalizacao++;
                    continue;
                }

                Optional<String> regiao = resolver.resolver(centro.getX(), centro.getY());
                if (regiao.isEmpty()) {
                    foraDeTodaRegiao++;
                    continue;
                }

                bulkOps.updateOne(
                        Query.query(Criteria.where("id").is(hospital.getId())),
                        Update.update("regiaoAdministrativa", regiao.get()).set("atualizadoEm", Instant.now()));
                naPagina++;
            }

            if (naPagina > 0) {
                bulkOps.execute();
                preenchidos += naPagina;
            }

            pagina = pagina.next();
        } while (page.hasNext());

        if (preenchidos == 0 && foraDeTodaRegiao == 0 && semLocalizacao == 0) {
            log.info("[RegiaoAdministrativa] {} estabelecimento(s) verificados: todos já com região preenchida.",
                    total);
        } else {
            log.info("[RegiaoAdministrativa] {} estabelecimento(s) verificados — {} região(ões) preenchida(s), "
                    + "{} fora de toda RA mapeada, {} sem localização.",
                    total, preenchidos, foraDeTodaRegiao, semLocalizacao);
        }
    }
}
