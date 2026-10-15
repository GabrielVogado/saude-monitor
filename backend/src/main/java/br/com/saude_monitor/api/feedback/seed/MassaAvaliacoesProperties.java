package br.com.saude_monitor.api.feedback.seed;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuração da massa de dados de avaliações do ambiente de desenvolvimento.
 *
 * <p>Prefixo {@code app.massa-avaliacoes}. Só tem efeito com o perfil Spring {@code dev}
 * ativo — ver {@link MassaAvaliacoesRunner}.</p>
 *
 * @param enabled liga a carga no startup (padrão {@code false})
 * @param modo    {@code skip-if-present} (padrão) não faz nada se a massa já existir;
 *                {@code recriar} apaga a massa anterior e gera outra com datas relativas
 *                a agora (a janela dos indicadores é de 90 dias — RN-14)
 * @param senha   senha dos usuários de teste; vazia = usuários sem login possível
 */
@ConfigurationProperties(prefix = "app.massa-avaliacoes")
public record MassaAvaliacoesProperties(
        boolean enabled,
        String modo,
        String senha
) {

    public static final String MODO_RECRIAR = "recriar";

    public boolean recriar() {
        return MODO_RECRIAR.equalsIgnoreCase(modo == null ? "" : modo.trim());
    }
}
