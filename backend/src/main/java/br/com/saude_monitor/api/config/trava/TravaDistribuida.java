package br.com.saude_monitor.api.config.trava;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Trava distribuída no MongoDB para tarefas que só uma instância deve executar por vez
 * (SOL-02): seed, reconciliações e migrações de inicialização.
 *
 * <p>Cada trava é um documento da coleção {@value #COLECAO} com {@code _id} igual ao nome
 * da tarefa. Adquirir é um único upsert condicionado a "não existe, ou já expirou": se outra
 * instância tem a trava válida, o upsert tenta inserir o mesmo {@code _id} e o índice único
 * do {@code _id} recusa. Não há janela entre ler e gravar, que era o defeito do
 * {@code count()} do seed com duas instâncias subindo juntas.</p>
 *
 * <p>A trava expira sozinha: se a instância que a tem morrer no meio, a próxima subida
 * depois da validade refaz a tarefa, que precisa ser idempotente.</p>
 */
@Slf4j
@Component
public class TravaDistribuida {

    /** Coleção das travas. */
    public static final String COLECAO = "travas_execucao";

    private final MongoTemplate mongoTemplate;

    /** Identifica esta instância como dona da trava; só a dona libera. */
    private final String dono = UUID.randomUUID().toString();

    public TravaDistribuida(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    /**
     * Executa a tarefa se conseguir a trava, e a libera ao final, com ou sem erro.
     *
     * @return {@code true} se a tarefa rodou aqui; {@code false} se outra instância a está
     *         executando (a tarefa é pulada, não esperada)
     */
    public boolean executar(String nome, Duration validade, Runnable tarefa) {
        if (!adquirir(nome, validade)) {
            log.info("[Trava] '{}' em execução em outra instância; pulada nesta.", nome);
            return false;
        }
        try {
            tarefa.run();
            return true;
        } finally {
            liberar(nome);
        }
    }

    boolean adquirir(String nome, Duration validade) {
        Instant agora = Instant.now();
        Query livre = Query.query(Criteria.where("_id").is(nome).and("expiraEm").lt(agora));
        Update update = new Update()
                .set("dono", dono)
                .set("adquiridaEm", agora)
                .set("expiraEm", agora.plus(validade));
        try {
            mongoTemplate.upsert(livre, update, COLECAO);
            return true;
        } catch (DuplicateKeyException _) {
            return false;
        }
    }

    void liberar(String nome) {
        mongoTemplate.remove(Query.query(Criteria.where("_id").is(nome).and("dono").is(dono)), COLECAO);
    }
}
