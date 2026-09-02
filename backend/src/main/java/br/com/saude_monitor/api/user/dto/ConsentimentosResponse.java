package br.com.saude_monitor.api.user.dto;

import br.com.saude_monitor.api.user.document.ConsentimentoItem;
import br.com.saude_monitor.api.user.document.ConsentimentosDocument;

import java.time.Instant;

/**
 * Estado atual dos consentimentos do titular (E5-05 / LGPD).
 *
 * <p>Devolvido após a atualização para que o app reflita exatamente o que foi
 * gravado — inclusive a data do aceite/revogação, que serve de comprovante.</p>
 */
public record ConsentimentosResponse(
        Finalidade localizacao,
        Finalidade notificacoes,
        Finalidade termosUso
) {

    /** Situação de uma finalidade específica. */
    public record Finalidade(boolean aceito, Instant data, String versao) {

        static Finalidade de(ConsentimentoItem item) {
            return item == null
                    ? new Finalidade(false, null, null)
                    : new Finalidade(item.isAceito(), item.getData(), item.getVersao());
        }
    }

    public static ConsentimentosResponse de(ConsentimentosDocument consentimentos) {
        if (consentimentos == null) {
            return new ConsentimentosResponse(
                    Finalidade.de(null), Finalidade.de(null), Finalidade.de(null));
        }
        return new ConsentimentosResponse(
                Finalidade.de(consentimentos.getLocalizacao()),
                Finalidade.de(consentimentos.getNotificacoes()),
                Finalidade.de(consentimentos.getTermosUso())
        );
    }
}
