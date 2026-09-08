package br.com.saude_monitor.api.config.security;

import br.com.saude_monitor.api.user.document.Papel;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Achado do code-review no PR-2 (achados de código morto/lógica duplicada): a
 * extração de {@link EmailNormalizer} trocou o e-mail nulo de {@code ""} (o que
 * antes ia para {@code findByEmail}) para {@code null} — nunca testado. Estes
 * testes cobrem o caminho normal e o guard contra {@code null}.
 */
class CustomUserDetailsServiceTest {

    private UserRepository userRepository;
    private CustomUserDetailsService service;

    @BeforeEach
    void setup() {
        userRepository = mock(UserRepository.class);
        service = new CustomUserDetailsService(userRepository);
    }

    @Test
    void carregaUsuarioPorEmailNormalizado() {
        UserDocument user = UserDocument.builder()
                .id("u1")
                .email("marina@email.com")
                .senhaHash("hash")
                .papel(Papel.USER)
                .active(true)
                .build();
        when(userRepository.findByEmail("marina@email.com")).thenReturn(Optional.of(user));

        UserDetails details = service.loadUserByUsername("  MARINA@email.com ");

        assertThat(details.getUsername()).isEqualTo("marina@email.com");
        assertThat(details.isEnabled()).isTrue();
        assertThat(details.getAuthorities()).extracting(Object::toString).contains("ROLE_USER");
    }

    @Test
    void emailNuloNaoChegaAoRepositorioENaoLancaExcecaoDeAcessoADados() {
        assertThatThrownBy(() -> service.loadUserByUsername(null))
                .isInstanceOf(UsernameNotFoundException.class);
        verify(userRepository, never()).findByEmail(eq(null));
    }

    @Test
    void usuarioInativoFicaDesabilitado() {
        UserDocument user = UserDocument.builder()
                .id("u1")
                .email("marina@email.com")
                .senhaHash("hash")
                .papel(Papel.USER)
                .active(false)
                .build();
        when(userRepository.findByEmail("marina@email.com")).thenReturn(Optional.of(user));

        UserDetails details = service.loadUserByUsername("marina@email.com");

        assertThat(details.isEnabled()).isFalse();
    }
}
