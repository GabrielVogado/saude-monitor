package br.com.saude_monitor.api.config.security;

import br.com.saude_monitor.api.user.util.EmailNormalizer;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Ticker;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Cache local do usuário de cada access token (ARQ-03).
 *
 * <p>Antes, toda requisição com token lia a conta no Mongo. Agora a conta lida fica
 * {@link #VALIDADE} na memória da instância. O access token já vale 15 minutos, então o
 * risco de papel ou situação desatualizados não muda de ordem de grandeza; a exclusão da
 * conta descarta a entrada na hora ({@link #esquecer(String)}) nesta instância, e nas
 * outras o efeito chega em até {@link #VALIDADE}.</p>
 *
 * <p>Conta inexistente não é guardada: a exceção do {@link CustomUserDetailsService} sobe
 * e a próxima requisição consulta de novo.</p>
 */
@Component
public class UsuarioAutenticadoCache {

    /** Tempo que a conta lida fica na memória. */
    public static final Duration VALIDADE = Duration.ofSeconds(60);

    /** Teto de entradas, para o cache não crescer sem limite por instância. */
    static final long MAXIMO_ENTRADAS = 10_000;

    private final CustomUserDetailsService userDetailsService;
    private final Cache<String, UserDetails> cache;

    @Autowired
    public UsuarioAutenticadoCache(CustomUserDetailsService userDetailsService) {
        this(userDetailsService, Ticker.systemTicker());
    }

    UsuarioAutenticadoCache(CustomUserDetailsService userDetailsService, Ticker ticker) {
        this.userDetailsService = userDetailsService;
        this.cache = Caffeine.newBuilder()
                .expireAfterWrite(VALIDADE)
                .maximumSize(MAXIMO_ENTRADAS)
                .ticker(ticker)
                .build();
    }

    /** Conta do e-mail do token, da memória ou do banco. */
    public UserDetails carregar(String email) {
        String chave = EmailNormalizer.normalizar(email);
        if (chave == null) {
            return userDetailsService.loadUserByUsername(email);
        }
        return cache.get(chave, userDetailsService::loadUserByUsername);
    }

    /** Descarta a conta da memória (exclusão da conta). */
    public void esquecer(String email) {
        String chave = EmailNormalizer.normalizar(email);
        if (chave != null) {
            cache.invalidate(chave);
        }
    }
}
