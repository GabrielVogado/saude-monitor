package br.com.saude_monitor.api.auth.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.function.LongSupplier;
import java.util.function.Supplier;

/**
 * Piso de tempo de resposta para as rotas que não podem revelar se um e-mail existe
 * (SOL-09, opção B da análise de escala).
 *
 * <p>"Esqueci a senha" e "reenviar confirmação" fazem consulta, código, gravação e envio de
 * e-mail só quando a conta existe. Com o envio dentro da requisição, a diferença de tempo
 * ficaria grande; com o piso, as duas respostas saem depois de {@link #PISO} contado da
 * chegada. O envio tem teto abaixo do piso ({@code ResendEmailService}), então só uma falha
 * fora do comum (banco lento, por exemplo) passa do piso.</p>
 */
@Component
public class TempoMinimoResposta {

    /** Tempo mínimo de resposta. */
    public static final Duration PISO = Duration.ofSeconds(2);

    /** Espera; nos testes, uma que só registra. */
    @FunctionalInterface
    interface Espera {
        void esperar(Duration duracao) throws InterruptedException;
    }

    private final Duration minimo;
    private final LongSupplier relogioNanos;
    private final Espera espera;

    @Autowired
    public TempoMinimoResposta() {
        this(PISO, System::nanoTime, Thread::sleep);
    }

    TempoMinimoResposta(Duration minimo, LongSupplier relogioNanos, Espera espera) {
        this.minimo = minimo;
        this.relogioNanos = relogioNanos;
        this.espera = espera;
    }

    /** Sem piso: para testes de quem usa esta classe. */
    public static TempoMinimoResposta semPiso() {
        return new TempoMinimoResposta(Duration.ZERO, System::nanoTime, duracao -> { });
    }

    /** Executa a operação e só devolve depois do piso, com ou sem erro. */
    public <T> T garantir(Supplier<T> operacao) {
        long inicio = relogioNanos.getAsLong();
        try {
            return operacao.get();
        } finally {
            completar(inicio);
        }
    }

    private void completar(long inicio) {
        Duration falta = minimo.minusNanos(relogioNanos.getAsLong() - inicio);
        if (falta.isNegative() || falta.isZero()) {
            return;
        }
        try {
            espera.esperar(falta);
        } catch (InterruptedException _) {
            Thread.currentThread().interrupt();
        }
    }
}
