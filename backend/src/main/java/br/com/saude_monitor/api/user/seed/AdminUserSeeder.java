package br.com.saude_monitor.api.user.seed;

import br.com.saude_monitor.api.user.document.Papel;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Cria um usuário ADMIN padrão no primeiro boot, se ainda não existir nenhum.
 *
 * <p>Resolve o gap de bootstrap: sem um ADMIN cadastrado, ninguém consegue
 * POST/PUT/PATCH em {@code /api/v1/hospitais/**} (403). Idempotente — não duplica.</p>
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "app.seed-admin", name = "enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
public class AdminUserSeeder implements ApplicationRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AdminSeedProperties properties;

    @Override
    public void run(ApplicationArguments args) {
        if (properties.email() == null || properties.email().isBlank()) {
            log.warn("[AdminSeed] E-mail de admin não configurado (app.seed-admin.email). Seed ignorado.");
            return;
        }

        // Idempotência: só cria se não existir NENHUM usuário ADMIN.
        if (userRepository.existsByPapel(Papel.ADMIN)) {
            log.info("[AdminSeed] Já existe usuário ADMIN. Nada a fazer.");
            return;
        }

        String senha = properties.senha() == null ? "" : properties.senha();
        UserDocument admin = UserDocument.builder()
                .fullName(properties.nome())
                .email(properties.email().trim().toLowerCase())
                .senhaHash(passwordEncoder.encode(senha))
                .papel(Papel.ADMIN)
                .active(true)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        userRepository.save(admin);
        log.info("[AdminSeed] Usuário ADMIN '{}' criado com sucesso.", properties.email());
    }
}
