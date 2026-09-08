package br.com.saude_monitor.api.user.seed;

import br.com.saude_monitor.api.user.document.Papel;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.ApplicationArguments;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Achado da auditoria de erros silenciosos (08/09/2026): com {@code email} configurado
 * mas {@code senha} ausente/vazio, o seed criava um admin com hash de senha vazia e
 * logava "criado com sucesso" — ninguém conseguia autenticar e não havia nenhum sinal
 * disso no boot. Estes testes cobrem o comportamento corrigido: abortar o seed.
 */
class AdminUserSeederTest {

    private UserRepository userRepository;
    private AdminUserSeeder seeder;

    @BeforeEach
    void setup() {
        userRepository = mock(UserRepository.class);
    }

    private AdminUserSeeder seederCom(AdminSeedProperties properties) {
        return new AdminUserSeeder(userRepository, new BCryptPasswordEncoder(), properties);
    }

    @Test
    void naoCriaAdminQuandoSenhaAusente() {
        when(userRepository.existsByPapel(Papel.ADMIN)).thenReturn(false);
        seeder = seederCom(new AdminSeedProperties(true, "admin@saude-monitor.com", null, "Admin"));

        seeder.run(mock(ApplicationArguments.class));

        verify(userRepository, never()).save(any(UserDocument.class));
    }

    @Test
    void naoCriaAdminQuandoSenhaEmBranco() {
        when(userRepository.existsByPapel(Papel.ADMIN)).thenReturn(false);
        seeder = seederCom(new AdminSeedProperties(true, "admin@saude-monitor.com", "   ", "Admin"));

        seeder.run(mock(ApplicationArguments.class));

        verify(userRepository, never()).save(any(UserDocument.class));
    }

    @Test
    void criaAdminQuandoEmailESenhaConfigurados() {
        when(userRepository.existsByPapel(Papel.ADMIN)).thenReturn(false);
        seeder = seederCom(new AdminSeedProperties(true, "admin@saude-monitor.com", "S3nh@Forte!", "Admin"));

        seeder.run(mock(ApplicationArguments.class));

        verify(userRepository).save(any(UserDocument.class));
    }
}
