package br.com.saude_monitor.api.auth.service;

import br.com.saude_monitor.api.user.util.EmailNormalizer;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;

/**
 * Limite de e-mails de código por endereço de destino (SEG-03).
 *
 * <p>O rate limit por IP não segura um bot que troca de IP: ele pode mandar dezenas de
 * códigos para a mesma caixa, ou gastar a cota diária do Resend (SOL-08). Aqui cada destino
 * recebe no máximo {@link #MAXIMO_POR_JANELA} códigos por {@link #JANELA}, somando cadastro,
 * reenvio e "esqueci a senha". O que passa disso é ignorado em silêncio: a resposta ao
 * cliente é a mesma, para o limite não virar um sinal de que o e-mail existe.</p>
 *
 * <p>Contagem em memória, por instância, como o rate limit (ARQ-02).</p>
 */
@Component
public class LimiteEnvioEmail {

    /** Códigos por destino em cada janela. */
    public static final int MAXIMO_POR_JANELA = 5;

    /** Janela fixa da contagem. */
    public static final Duration JANELA = Duration.ofHours(1);

    private final Clock clock;
    private final Cache<String, long[]> contadores = Caffeine.newBuilder()
            .expireAfterAccess(JANELA.multipliedBy(2))
            .maximumSize(100_000)
            .build();

    @Autowired
    public LimiteEnvioEmail() {
        this(Clock.systemUTC());
    }

    LimiteEnvioEmail(Clock clock) {
        this.clock = clock;
    }

    /** Registra um envio para o destino e diz se ele ainda cabe na janela. */
    public boolean tentarRegistrarEnvio(String destino) {
        long agora = clock.millis();
        long janelaInicio = agora - (agora % JANELA.toMillis());
        long[] estado = contadores.asMap().compute(EmailNormalizer.normalizar(destino), (k, atual) -> {
            if (atual == null || atual[0] != janelaInicio) {
                return new long[]{janelaInicio, 1L};
            }
            atual[1]++;
            return atual;
        });
        return estado[1] <= MAXIMO_POR_JANELA;
    }
}
