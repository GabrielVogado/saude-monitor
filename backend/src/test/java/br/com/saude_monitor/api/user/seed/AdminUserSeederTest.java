package br.com.saude_monitor.api.user.seed;

import br.com.saude_monitor.api.config.trava.TravasDeTeste;
import br.com.saude_monitor.api.user.document.Papel;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.ApplicationArguments;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Achado da auditoria de erros silenciosos (08/09/2026): com {@code email} configurado
 * mas {@code senha} ausente/vazio, o seed criava um admin com hash de senha vazia e
 * logava "criado com sucesso". Desde o SEG-07 (18/10/2026), seed ligado sem e-mail, sem
 * senha ou com senha curta falha o boot, em vez de pular em silêncio.
 */
class AdminUserSeederTest {

    private UserRepository userRepository;
    private AdminUserSeeder seeder;

    @BeforeEach
    void setup() {
        userRepository = mock(UserRepository.class);
    }

    private AdminUserSeeder seederCom(AdminSeedProperties properties) {
        return new AdminUserSeeder(userRepository, new BCryptPasswordEncoder(), properties, TravasDeTeste.criarTravaLivre());
    }

    private void verificarFalhaNoBoot(AdminSeedProperties properties) {
        seeder = seederCom(properties);

        assertThatThrownBy(() -> seeder.run(mock(ApplicationArguments.class)))
                .isInstanceOf(IllegalStateException.class);
        verify(userRepository, never()).save(any(UserDocument.class));
    }

    @Test
    void bootFalhaQuandoSenhaAusente() {
        verificarFalhaNoBoot(new AdminSeedProperties(true, "admin@saude-monitor.com", null, "Admin"));
    }

    @Test
    void bootFalhaQuandoSenhaEmBranco() {
        verificarFalhaNoBoot(new AdminSeedProperties(true, "admin@saude-monitor.com", "   ", "Admin"));
    }

    @Test
    void bootFalhaComASenhaPadraoAntiga() {
        verificarFalhaNoBoot(new AdminSeedProperties(true, "admin@saude.com", "admin123", "Admin"));
    }

    @Test
    void bootFalhaSemEmail() {
        verificarFalhaNoBoot(new AdminSeedProperties(true, " ", "S3nh@Forte!2026", "Admin"));
        verificarFalhaNoBoot(new AdminSeedProperties(true, null, "S3nh@Forte!2026", "Admin"));
    }

    @Test
    void naoDuplicaQuandoJaExisteAdmin() {
        when(userRepository.existsByPapel(Papel.ADMIN)).thenReturn(true);
        seeder = seederCom(new AdminSeedProperties(true, "admin@saude-monitor.com", "S3nh@Forte!2026", "Admin"));

        seeder.run(mock(ApplicationArguments.class));

        verify(userRepository, never()).save(any(UserDocument.class));
    }

    @Test
    void criaAdminQuandoEmailESenhaConfigurados() {
        when(userRepository.existsByPapel(Papel.ADMIN)).thenReturn(false);
        seeder = seederCom(new AdminSeedProperties(true, "admin@saude-monitor.com", "S3nh@Forte!2026", "Admin"));

        seeder.run(mock(ApplicationArguments.class));

        verify(userRepository).save(any(UserDocument.class));
    }

    @Test
    void naoFazNadaQuandoOutraInstanciaEstaSemeando() {
        // SOL-02: duas instâncias subindo juntas não criam dois admins.
        seeder = new AdminUserSeeder(userRepository, new BCryptPasswordEncoder(),
                new AdminSeedProperties(true, "admin@saude-monitor.com", "S3nh@Forte!2026", "Admin"),
                TravasDeTeste.criarTravaOcupada());

        seeder.run(mock(ApplicationArguments.class));

        verify(userRepository, never()).existsByPapel(any());
        verify(userRepository, never()).save(any(UserDocument.class));
    }
}
