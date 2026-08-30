package br.com.saude_monitor.api.config.ratelimit;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Rate limiting por IP com janela deslizante (F0-04).
 *
 * <p>Mantém um cache in-memory thread-safe de contadores por chave (IP + grupo de
 * recurso) dentro de uma janela de 1 minuto. Quando o limite é excedido, devolve
 * false para que o filtro responda 429 no envelope padrão da API.</p>
 *
 * <p>Grupos configurados (spec F0-04):</p>
 * <ul>
 *   <li>{@code AUTH} — login/refresh: 10 req/min/IP</li>
 *   <li>{@code PUBLICO} — demais endpoints públicos: 60 req/min/IP</li>
 * </ul>
 */
@Service
public class RateLimitService {

    /** Janela em milissegundos (1 minuto). */
    static final long JANELA_MS = 60_000L;

    public enum Grupo {
        AUTH(10),
        PUBLICO(60);

        private final int limite;

        Grupo(int limite) {
            this.limite = limite;
        }

        public int limite() {
            return limite;
        }
    }

    /** Chave -> [janelaInicio, contador]. */
    private final ConcurrentMap<String, long[]> contadores = new ConcurrentHashMap<>();

    /**
     * Tenta registrar uma requisição para a chave no grupo.
     *
     * @return {@code true} se dentro do limite; {@code false} se deve ser bloqueado (429).
     */
    public boolean tentarConsumir(String chave, Grupo grupo) {
        long agora = System.currentTimeMillis();
        long janelaInicio = agora - (agora % JANELA_MS);

        long[] estado = contadores.compute(chave + ":" + grupo.name(), (k, atual) -> {
            if (atual == null || atual[0] != janelaInicio) {
                return new long[]{janelaInicio, 1L};
            }
            atual[1] = atual[1] + 1L;
            return atual;
        });

        return estado[1] <= grupo.limite();
    }

    /** Limpeza periódica de janelas antigas para evitar vazamento de memória. */
    void limparObsoletos(long agora) {
        contadores.entrySet().removeIf(e -> agora - e.getValue()[0] > (2 * JANELA_MS));
    }

    /** Executa a limpeza a cada minuto via agendamento do Spring. */
    @Scheduled(fixedDelay = JANELA_MS)
    public void limparPeriodicamente() {
        limparObsoletos(System.currentTimeMillis());
    }
}
