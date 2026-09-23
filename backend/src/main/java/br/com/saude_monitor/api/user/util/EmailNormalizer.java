package br.com.saude_monitor.api.user.util;

import java.util.Locale;

/**
 * Normalização de e-mail (trim + minúsculas) usada em todo ponto que compara ou grava
 * um e-mail contra a coleção {@code users}.
 *
 * <p>Antes desta extração, a mesma regra era reimplementada de forma independente em
 * {@code AuthServiceImpl}, {@code UserServiceImpl}, {@code CustomUserDetailsService} e
 * {@code AutenticacaoHelper} — esta última sem {@code trim()}, o que podia deixar um
 * usuário autenticado (token válido) sem ser encontrado nas consultas que dependiam
 * dela, caso um e-mail com espaço à direita escapasse do trim em algum outro ponto.</p>
 */
public final class EmailNormalizer {

    private EmailNormalizer() {
    }

    public static String normalizar(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
