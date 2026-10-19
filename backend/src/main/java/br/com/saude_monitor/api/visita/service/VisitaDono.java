package br.com.saude_monitor.api.visita.service;

import br.com.saude_monitor.api.visita.document.VisitaDocument;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Regra única de dono da visita, usada no checkout, no heartbeat e no feedback (SEG-02 da
 * Análise de Escalabilidade e Segurança v1.0).
 *
 * <p>Visita de usuário logado pertence ao {@code usuarioId}. Visita anônima pertence ao
 * aparelho que fez o check-in: o {@code dispositivoId} é um UUID v4 aleatório gerado no
 * aparelho e nunca devolvido pela API, então funciona como a credencial do anônimo. Antes
 * desta regra, quem soubesse o id da visita anônima (um {@code ObjectId}, que tem carimbo de
 * tempo e contador sequencial) podia encerrá-la, mantê-la viva ou avaliá-la.</p>
 */
public final class VisitaDono {

    private VisitaDono() {
    }

    /**
     * {@code true} quando quem chama é dono da visita. Visita anônima sem
     * {@code dispositivoId} gravado (ex.: conta excluída, M-041) não tem dono.
     */
    public static boolean isDonoDaVisita(VisitaDocument visita, String usuarioId, String dispositivoId) {
        if (visita.getUsuarioId() != null) {
            return visita.getUsuarioId().equals(usuarioId);
        }
        return isIgual(visita.getDispositivoId(), dispositivoId);
    }

    /** Comparação em tempo constante: o id do aparelho é segredo. */
    private static boolean isIgual(String esperado, String informado) {
        if (esperado == null || esperado.isBlank() || informado == null) {
            return false;
        }
        return MessageDigest.isEqual(
                esperado.getBytes(StandardCharsets.UTF_8), informado.getBytes(StandardCharsets.UTF_8));
    }
}
