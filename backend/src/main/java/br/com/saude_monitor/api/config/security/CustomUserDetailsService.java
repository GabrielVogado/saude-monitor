package br.com.saude_monitor.api.config.security;

import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.repository.UserRepository;
import br.com.saude_monitor.api.user.util.EmailNormalizer;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * Carrega o usuário pelo e-mail para a autenticação JWT (F0-01).
 *
 * <p>Converte {@link UserDocument} em {@link UserDetails}, usando o {@code senhaHash}
 * (BCrypt) e o papel como autoridade {@code ROLE_<PAPEL>}. Usuários inativos são
 * marcados como {@code disabled}, bloqueando o acesso mesmo com token válido.</p>
 */
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        UserDocument user = userRepository.findByEmail(EmailNormalizer.normalizar(email))
                .orElseThrow(() -> new UsernameNotFoundException("Usuário não encontrado: " + email));

        String papel = user.getPapel() == null ? "USER" : user.getPapel().name();

        return User.withUsername(user.getEmail())
                .password(user.getSenhaHash() == null ? "" : user.getSenhaHash())
                .roles(papel)
                .disabled(!user.isActive())
                .build();
    }
}
