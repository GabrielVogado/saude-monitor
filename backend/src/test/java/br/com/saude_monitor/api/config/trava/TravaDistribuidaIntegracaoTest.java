package br.com.saude_monitor.api.config.trava;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import org.bson.Document;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

/**
 * Trava distribuída contra Mongo real (SOL-02): o que garante a exclusão é o índice único
 * do {@code _id}, então só um banco de verdade prova o comportamento.
 */
@Testcontainers
class TravaDistribuidaIntegracaoTest {

    @Container
    static final MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

    private static MongoClient cliente;
    private static MongoTemplate mongoTemplate;

    private static final Duration VALIDADE = Duration.ofMinutes(5);

    @BeforeAll
    static void conectar() {
        cliente = MongoClients.create(mongo.getReplicaSetUrl());
        mongoTemplate = new MongoTemplate(cliente, "trava-teste");
    }

    @AfterAll
    static void desconectar() {
        cliente.close();
    }

    @BeforeEach
    void limpar() {
        mongoTemplate.dropCollection(TravaDistribuida.COLECAO);
    }

    @Test
    void segundaInstanciaNaoAdquireTravaValida() {
        TravaDistribuida a = new TravaDistribuida(mongoTemplate);
        TravaDistribuida b = new TravaDistribuida(mongoTemplate);

        assertThat(a.adquirir("seed", VALIDADE)).isTrue();
        assertThat(b.adquirir("seed", VALIDADE)).isFalse();
        assertThat(b.adquirir("outra-tarefa", VALIDADE)).isTrue();
    }

    @Test
    void soADonaLiberaATrava() {
        TravaDistribuida a = new TravaDistribuida(mongoTemplate);
        TravaDistribuida b = new TravaDistribuida(mongoTemplate);
        a.adquirir("seed", VALIDADE);

        b.liberar("seed");
        assertThat(b.adquirir("seed", VALIDADE)).isFalse();

        a.liberar("seed");
        assertThat(b.adquirir("seed", VALIDADE)).isTrue();
    }

    @Test
    void travaVencidaPodeSerTomadaPorOutraInstancia() {
        // A dona morreu no meio: a trava venceu e a próxima subida refaz a tarefa.
        mongoTemplate.getCollection(TravaDistribuida.COLECAO).insertOne(new Document("_id", "seed")
                .append("dono", "instancia-morta")
                .append("expiraEm", Date.from(Instant.now().minusSeconds(1))));

        assertThat(new TravaDistribuida(mongoTemplate).adquirir("seed", VALIDADE)).isTrue();
    }

    @Test
    void executarRodaUmaVezELiberaMesmoComErro() {
        TravaDistribuida a = new TravaDistribuida(mongoTemplate);

        assertThatThrownBy(() -> a.executar("seed", VALIDADE, () -> {
            throw new IllegalStateException("falhou no meio");
        })).isInstanceOf(IllegalStateException.class);

        AtomicInteger execucoes = new AtomicInteger();
        assertThat(a.executar("seed", VALIDADE, execucoes::incrementAndGet)).isTrue();
        assertThat(execucoes).hasValue(1);
    }

    @Test
    void executarPulaQuandoOutraInstanciaTemATrava() {
        new TravaDistribuida(mongoTemplate).adquirir("seed", VALIDADE);
        AtomicInteger execucoes = new AtomicInteger();

        assertThat(new TravaDistribuida(mongoTemplate).executar("seed", VALIDADE, execucoes::incrementAndGet)).isFalse();
        assertThat(execucoes).hasValue(0);
    }

    @Test
    void instanciasSubindoJuntasExecutamATarefaUmaVezSo() throws Exception {
        int instancias = 8;
        AtomicInteger execucoes = new AtomicInteger();
        CountDownLatch largada = new CountDownLatch(1);
        CountDownLatch soltar = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(instancias);
        try {
            List<Future<Boolean>> subidas = new ArrayList<>();
            for (int i = 0; i < instancias; i++) {
                subidas.add(pool.submit(() -> {
                    largada.await();
                    // A que consegue a trava a segura até as outras desistirem.
                    return new TravaDistribuida(mongoTemplate).executar("seed", VALIDADE, () -> {
                        execucoes.incrementAndGet();
                        aguardar(soltar);
                    });
                }));
            }
            largada.countDown();
            await().atMost(Duration.ofSeconds(10))
                    .until(() -> subidas.stream().filter(Future::isDone).count() == instancias - 1);
            soltar.countDown();

            int rodaram = 0;
            for (Future<Boolean> subida : subidas) {
                rodaram += subida.get() ? 1 : 0;
            }
            assertThat(rodaram).isEqualTo(1);
            assertThat(execucoes).hasValue(1);
        } finally {
            pool.shutdownNow();
        }
    }

    private static void aguardar(CountDownLatch sinal) {
        try {
            sinal.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
