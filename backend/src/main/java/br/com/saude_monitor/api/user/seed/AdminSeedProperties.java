package br.com.saude_monitor.api.user.seed;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuração do seed de usuário ADMIN inicial (primeiro boot).
 *
 * <p>Prefixo {@code app.seed-admin}. Quando {@code enabled=true}, o
 * {@link AdminUserSeeder} cria um usuário ADMIN padrão se ainda não existir
 * nenhum usuário com papel ADMIN na base.</p>
 */
@ConfigurationProperties(prefix = "app.seed-admin")
public record AdminSeedProperties(
        boolean enabled,
        String email,
        String senha,
        String nome
) {
}
