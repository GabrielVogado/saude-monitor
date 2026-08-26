package br.com.saude_monitor.api.config.security;

import br.com.saude_monitor.api.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Optional;

/**
 * Helper para obter informações do usuário autenticado no contexto de segurança.
 */
@Component
@RequiredArgsConstructor
public class AutenticacaoHelper {

    private final UserRepository userRepository;

    public Optional<String> usuarioIdAtual() {
        return usuarioEmailAtual()
                .flatMap(email -> userRepository.findByEmail(email.toLowerCase(Locale.ROOT)))
                .map(u -> u.getId());
    }

    public Optional<String> usuarioEmailAtual() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return Optional.empty();
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof UserDetails userDetails) {
            return Optional.ofNullable(userDetails.getUsername());
        }
        return Optional.empty();
    }
}
