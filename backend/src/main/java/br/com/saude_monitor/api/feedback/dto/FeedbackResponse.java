package br.com.saude_monitor.api.feedback.dto;

import br.com.saude_monitor.api.feedback.document.FezTriagem;
import br.com.saude_monitor.api.feedback.document.FoiAtendido;
import br.com.saude_monitor.api.feedback.document.MedicacaoReceita;
import br.com.saude_monitor.api.feedback.document.MotivoNaoAtendido;
import br.com.saude_monitor.api.feedback.document.TeveMedico;

import java.time.Instant;

/**
 * Resposta de criação de feedback (§3.4 — {@code POST /api/v1/feedbacks} → 201).
 */
public record FeedbackResponse(
        String id,
        String visitaId,
        String hospitalId,
        FoiAtendido foiAtendido,
        MotivoNaoAtendido motivoNaoAtendido,
        TeveMedico teveMedico,
        FezTriagem fezTriagem,
        MedicacaoReceita medicacaoReceita,
        String especialidadeProcurada,
        Integer nota,
        Integer tratamentoEquipe,
        String comentario,
        boolean anonimizado,
        Instant criadoEm,
        boolean recebido
) {
}
