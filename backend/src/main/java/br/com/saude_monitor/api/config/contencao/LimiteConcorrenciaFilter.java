package br.com.saude_monitor.api.config.contencao;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Teto de requisições simultâneas por instância (ARQ-05).
 *
 * <p>Com virtual threads, cada requisição ganha uma thread barata e nada segura a fila: num
 * pico, milhares de requisições disputam as poucas conexões do banco, esperam juntas e
 * estouram o tempo juntas, e a instância passa a não atender ninguém. Com o teto, o que passa
 * dele recebe 503 {@code SERVICO_SOBRECARREGADO} na hora, com {@code Retry-After}, e o que
 * está dentro termina no tempo normal. Com mais de uma instância, o 503 também é o sinal para
 * o Cloud Run mandar a requisição seguinte para outra.</p>
 *
 * <p>Não espera vaga: esperar seria a mesma fila que o teto existe para evitar. Os endpoints
 * do Actuator ficam de fora, para a verificação de saúde não falhar só porque a instância
 * está cheia.</p>
 */
@Slf4j
@Component
public class LimiteConcorrenciaFilter extends OncePerRequestFilter {

    static final String CODIGO = "SERVICO_SOBRECARREGADO";
    static final String MENSAGEM = "O serviço está com muitas requisições agora. Tente de novo em instantes.";

    private final Semaphore vagas;
    private final ContencaoProperties properties;
    private final ObjectMapper objectMapper;

    /** Recusas desde a última linha de log, para registrar uma vez por rajada e não uma por requisição. */
    private final AtomicLong recusadas = new AtomicLong();

    public LimiteConcorrenciaFilter(ContencaoProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.vagas = new Semaphore(properties.requisicoesSimultaneas());
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getRequestURI().startsWith("/actuator");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (!vagas.tryAcquire()) {
            if (recusadas.getAndIncrement() == 0) {
                log.warn("[Contencao] {} requisições simultâneas atingidas; respondendo 503.",
                        properties.requisicoesSimultaneas());
            }
            RespostaIndisponivel.escrever(response, objectMapper, CODIGO, MENSAGEM, properties.retryAfterSegundos());
            return;
        }
        try {
            filterChain.doFilter(request, response);
        } finally {
            vagas.release();
            long anteriores = recusadas.getAndSet(0);
            if (anteriores > 0) {
                log.info("[Contencao] vaga liberada depois de {} recusas.", anteriores);
            }
        }
    }

    /** Vagas livres agora (para teste). */
    int vagasLivres() {
        return vagas.availablePermits();
    }
}
