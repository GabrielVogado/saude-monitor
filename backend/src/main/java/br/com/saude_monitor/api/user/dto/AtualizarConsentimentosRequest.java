package br.com.saude_monitor.api.user.dto;

/**
 * Atualização dos consentimentos do titular (E5-05 / art. 8º §5º da LGPD —
 * "o consentimento pode ser revogado a qualquer momento").
 *
 * <p>Campos nulos são <strong>ignorados</strong>: o app envia apenas a finalidade
 * que o usuário alterou, e as demais mantêm data e versão originais.</p>
 *
 * <p>O aceite dos termos de uso não entra aqui: por ser a base legal da conta
 * (art. 7º, I), revogá-lo equivale a excluir a conta
 * ({@code DELETE /api/v1/contas/exclusao}).</p>
 *
 * @param localizacao  novo estado do consentimento de localização (geofencing)
 * @param notificacoes novo estado do consentimento de notificações
 * @param versaoTermos versão do aviso de privacidade exibido ao usuário na decisão;
 *                     quando ausente, mantém a versão vigente do registro
 */
public record AtualizarConsentimentosRequest(
        Boolean localizacao,
        Boolean notificacoes,
        String versaoTermos
) {

    /** Indica se o payload traz alguma finalidade para atualizar. */
    public boolean vazio() {
        return localizacao == null && notificacoes == null;
    }
}
