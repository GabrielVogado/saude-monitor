package br.com.saude_monitor.api.config.security;

import com.github.benmanes.caffeine.cache.Ticker;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Cache local do usuário de cada access token (ARQ-03). */
class UsuarioAutenticadoCacheTest {

    private static final String EMAIL = "maria@email.com";

    private final CustomUserDetailsService userDetailsService = mock(CustomUserDetailsService.class);
    private final AtomicLong nanos = new AtomicLong();
    private final Ticker ticker = nanos::get;
    private final UsuarioAutenticadoCache cache = new UsuarioAutenticadoCache(userDetailsService, ticker);

    private final UserDetails maria = User.withUsername(EMAIL).password("x").roles("USER").build();

    @Test
    void leOBancoUmaVezDentroDaValidadeMesmoComOutraCaixaNoEmail() {
        when(userDetailsService.loadUserByUsername(EMAIL)).thenReturn(maria);

        UserDetails primeiro = cache.carregar(EMAIL);
        UserDetails segundo = cache.carregar(" Maria@Email.com ");

        assertThat(segundo).isSameAs(primeiro);
        verify(userDetailsService, times(1)).loadUserByUsername(EMAIL);
    }

    @Test
    void leOBancoDeNovoDepoisDaValidade() {
        when(userDetailsService.loadUserByUsername(EMAIL)).thenReturn(maria);

        cache.carregar(EMAIL);
        nanos.addAndGet(UsuarioAutenticadoCache.VALIDADE.toNanos() + 1);
        cache.carregar(EMAIL);

        verify(userDetailsService, times(2)).loadUserByUsername(EMAIL);
    }

    @Test
    void esquecerFazAProximaRequisicaoConsultarOBanco() {
        when(userDetailsService.loadUserByUsername(EMAIL))
                .thenReturn(maria)
                .thenThrow(new UsernameNotFoundException("excluída"));

        cache.carregar(EMAIL);
        cache.esquecer("MARIA@email.com");

        assertThatThrownBy(() -> cache.carregar(EMAIL)).isInstanceOf(UsernameNotFoundException.class);
    }

    @Test
    void contaInexistenteNaoFicaGuardada() {
        when(userDetailsService.loadUserByUsername(EMAIL))
                .thenThrow(new UsernameNotFoundException("não existe"))
                .thenReturn(maria);

        assertThatThrownBy(() -> cache.carregar(EMAIL)).isInstanceOf(UsernameNotFoundException.class);
        assertThat(cache.carregar(EMAIL)).isSameAs(maria);
    }

    @Test
    void emailNuloVaiDiretoAoServicoEEsquecerNuloNaoFazNada() {
        when(userDetailsService.loadUserByUsername(null)).thenThrow(new UsernameNotFoundException("vazio"));

        assertThatThrownBy(() -> cache.carregar(null)).isInstanceOf(UsernameNotFoundException.class);
        cache.esquecer(null);
        verify(userDetailsService, times(1)).loadUserByUsername(null);
    }
}
