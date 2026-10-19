package br.com.saude_monitor.api.config.ratelimit;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Rate limiting com janela fixa de 1 minuto (F0-04), por identidade e por IP (ARQ-02).
 *
 * <p>Mantém um cache in-memory thread-safe de contadores por chave (IP + grupo de
 * recurso) dentro de uma janela de 1 minuto. Quando o limite é excedido, devolve
 * false para que o filtro responda 429 no envelope padrão da API.</p>
 *
 * <p>Grupos (spec F0-04), com os limites vindos de {@link RateLimitProperties}:</p>
 * <ul>
 *   <li>{@code AUTH} — cadastro, confirmação e senha: padrão 10 req/min por IP;</li>
 *   <li>{@code LOGIN} — 10 req/min por conta, além do {@code AUTH} por IP;</li>
 *   <li>{@code REFRESH} — 10 req/min por refresh token;</li>
 *   <li>{@code PUBLICO} — demais endpoints públicos: padrão 60 req/min por usuário,
 *       instalação do app ou IP;</li>
 *   <li>{@code IP} — teto de abuso por IP, padrão 600 req/min.</li>
 * </ul>
 *
 * <p>Os contadores ficam em memória, por instância. Com N instâncias o limite efetivo
 * multiplica por N, o que é aceitável enquanto o limite é por identidade; o teto global
 * de abuso por IP fica para a borda (SOL-03).</p>
 */
@Service
public class RateLimitService {

    /** Janela em milissegundos (1 minuto). */
    static final long JANELA_MS = 60_000L;

    public enum Grupo {
        /** Rotas de autenticação sem outra identidade (cadastro, confirmação, senha), por IP. */
        AUTH,
        /** Rotas públicas, por usuário, instalação do app ou IP, nesta ordem. */
        PUBLICO,
        /** Login, por conta (e-mail), além do limite por IP do {@link #AUTH}. */
        LOGIN,
        /** Renovação de sessão, pelo próprio refresh token, nunca pelo IP. */
        REFRESH,
        /** Teto de abuso por IP, somando o tráfego limitado inteiro. */
        IP
    }

    private final RateLimitProperties properties;

    /** Chave -> [janelaInicio, contador]. */
    private final ConcurrentMap<String, long[]> contadores = new ConcurrentHashMap<>();

    public RateLimitService(RateLimitProperties properties) {
        this.properties = properties;
    }

    /** Limite do grupo por minuto, conforme a configuração do ambiente. */
    public int limite(Grupo grupo) {
        return switch (grupo) {
            case AUTH, LOGIN, REFRESH -> properties.authPorMinuto();
            case PUBLICO -> properties.publicoPorMinuto();
            case IP -> Math.max(properties.ipPorMinuto(),
                    Math.max(properties.authPorMinuto(), properties.publicoPorMinuto()));
        };
    }

    /**
     * Tenta registrar uma requisição para a chave no grupo.
     *
     * @return {@code true} se dentro do limite; {@code false} se deve ser bloqueado (429).
     */
    public boolean tentarConsumir(String chave, Grupo grupo) {
        return registrar(chave, grupo) <= limite(grupo);
    }

    /**
     * Registra a requisição e devolve quantas a chave já fez na janela atual (incluindo
     * esta). O filtro usa o número para registrar em log só a PRIMEIRA rejeição de cada
     * chave por janela — logar toda rejeição transformaria um ataque num volume de log.
     */
    public long registrar(String chave, Grupo grupo) {
        long agora = System.currentTimeMillis();
        long janelaInicio = agora - (agora % JANELA_MS);

        long[] estado = contadores.compute(chave + ":" + grupo.name(), (k, atual) -> {
            if (atual == null || atual[0] != janelaInicio) {
                return new long[]{janelaInicio, 1L};
            }
            atual[1] = atual[1] + 1L;
            return atual;
        });

        return estado[1];
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
