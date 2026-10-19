package br.com.saude_monitor.api.config.trava;

import java.time.Duration;

/** Travas para testes de unidade das tarefas que usam {@link TravaDistribuida}. */
public final class TravasDeTeste {

    private TravasDeTeste() {
    }

    /** Sempre consegue a trava: a tarefa roda como se só houvesse esta instância. */
    public static TravaDistribuida criarTravaLivre() {
        return new TravaDistribuida(null) {
            @Override
            public boolean executar(String nome, Duration validade, Runnable tarefa) {
                tarefa.run();
                return true;
            }
        };
    }

    /** Nunca consegue a trava: outra instância está executando a tarefa. */
    public static TravaDistribuida criarTravaOcupada() {
        return new TravaDistribuida(null) {
            @Override
            public boolean executar(String nome, Duration validade, Runnable tarefa) {
                return false;
            }
        };
    }
}
