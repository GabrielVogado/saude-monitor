package br.com.saude_monitor.api.user.seed;

import br.com.saude_monitor.api.config.trava.TravaDistribuida;
import br.com.saude_monitor.api.user.document.Papel;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.repository.UserRepository;
import br.com.saude_monitor.api.user.util.EmailNormalizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

/**
 * Cria um usuário ADMIN no primeiro boot, se ainda não existir nenhum.
 *
 * <p>Resolve o gap de bootstrap: sem um ADMIN cadastrado, ninguém consegue
 * POST/PUT/PATCH em {@code /api/v1/hospitais/**} (403). Idempotente — não duplica.</p>
 *
 * <p>SEG-07: só roda ligado de propósito ({@code app.seed-admin.enabled=true}) e não há
 * e-mail nem senha padrão no código. Ligado sem e-mail, sem senha ou com senha curta, a
 * aplicação não sobe: um admin com senha conhecida num serviço público é pior do que nenhum,
 * e o erro no boot aparece na hora, ao contrário de um seed pulado em silêncio.</p>
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "app.seed-admin", name = "enabled", havingValue = "true")
@RequiredArgsConstructor
public class AdminUserSeeder implements ApplicationRunner {

    /** Nome da trava desta tarefa ({@link TravaDistribuida}). */
    static final String NOME_TRAVA = "seed-admin";

    /** Folga para a tarefa terminar; se a instância morrer no meio, a trava vence e outra refaz. */
    private static final Duration VALIDADE_TRAVA = Duration.ofMinutes(2);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AdminSeedProperties properties;

    /** Uma instância por vez (SOL-02): as outras pulam enquanto esta executa. */
    private final TravaDistribuida trava;

    /** Menor senha aceita para o admin semeado. */
    static final int SENHA_MINIMA = 12;

    @Override
    public void run(ApplicationArguments args) {
        validarConfiguracao();
        trava.executar(NOME_TRAVA, VALIDADE_TRAVA, this::executar);
    }

    /** Falha o boot quando o seed está ligado sem credencial utilizável (SEG-07). */
    private void validarConfiguracao() {
        if (properties.email() == null || properties.email().isBlank()) {
            throw new IllegalStateException(
                    "Seed de admin ligado sem ADMIN_EMAIL. Configure o e-mail ou desligue APP_SEEDADMIN_ENABLED.");
        }
        if (properties.senha() == null || properties.senha().isBlank()
                || properties.senha().strip().length() < SENHA_MINIMA) {
            throw new IllegalStateException("Seed de admin ligado sem ADMIN_SENHA com pelo menos "
                    + SENHA_MINIMA + " caracteres. Configure a senha ou desligue APP_SEEDADMIN_ENABLED.");
        }
    }

    private void executar() {
        // Idempotência: só cria se não existir NENHUM usuário ADMIN.
        if (userRepository.existsByPapel(Papel.ADMIN)) {
            log.info("[AdminSeed] Já existe usuário ADMIN. Nada a fazer.");
            return;
        }

        UserDocument admin = UserDocument.builder()
                .fullName(properties.nome())
                .email(EmailNormalizer.normalizar(properties.email()))
                .senhaHash(passwordEncoder.encode(properties.senha()))
                .papel(Papel.ADMIN)
                .active(true)
                .emailVerificado(true)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        userRepository.save(admin);
        log.info("[AdminSeed] Usuário ADMIN '{}' criado com sucesso.", properties.email());
    }
}
