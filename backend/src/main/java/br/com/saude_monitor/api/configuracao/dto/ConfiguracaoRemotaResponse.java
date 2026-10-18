package br.com.saude_monitor.api.configuracao.dto;

/**
 * Configuração remota que o app lê ao abrir (ARQ-09).
 *
 * @param modoSomenteLeitura o servidor recusa gravações agora (check-in, avaliação, cadastro)
 * @param versaoMinimaApp    menor versão do app aceita; {@code null} quando não há mínimo
 * @param mensagem           texto do aviso de manutenção; {@code null} usa o texto do app
 */
public record ConfiguracaoRemotaResponse(
        boolean modoSomenteLeitura,
        String versaoMinimaApp,
        String mensagem
) {

    /** Sem documento gravado: tudo liberado. */
    public static final ConfiguracaoRemotaResponse PADRAO = new ConfiguracaoRemotaResponse(false, null, null);
}
