package br.com.saude_monitor.api.configuracao.dto;

/**
 * Configuração remota que o app lê ao abrir e ao voltar ao primeiro plano (ARQ-09).
 *
 * @param modoSomenteLeitura o servidor recusa gravações agora (check-in, avaliação, cadastro)
 * @param versaoMinimaApp    menor versão do app aceita; {@code null} quando não há mínimo
 * @param mensagem           texto do aviso de manutenção; {@code null} usa o texto do app
 * @param versaoCatalogo     versão atual do catálogo de estabelecimentos: quando difere da
 *                           cópia do aparelho, o app baixa o catálogo de novo; {@code null}
 *                           quando não foi possível montar o catálogo agora (o app mantém a cópia)
 */
public record ConfiguracaoRemotaResponse(
        boolean modoSomenteLeitura,
        String versaoMinimaApp,
        String mensagem,
        String versaoCatalogo
) {

    /** Sem documento gravado: tudo liberado. */
    public static final ConfiguracaoRemotaResponse PADRAO = new ConfiguracaoRemotaResponse(false, null, null);

    /** Configuração gravada pelo painel, ainda sem a versão do catálogo (o controller público a junta). */
    public ConfiguracaoRemotaResponse(boolean modoSomenteLeitura, String versaoMinimaApp, String mensagem) {
        this(modoSomenteLeitura, versaoMinimaApp, mensagem, null);
    }

    /** A mesma configuração com a versão do catálogo informada. */
    public ConfiguracaoRemotaResponse comVersaoCatalogo(String versao) {
        return new ConfiguracaoRemotaResponse(modoSomenteLeitura, versaoMinimaApp, mensagem, versao);
    }
}
