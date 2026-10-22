package br.com.saude_monitor.api.feedback.dto;

import br.com.saude_monitor.api.feedback.document.FezTriagem;
import br.com.saude_monitor.api.feedback.document.FoiAtendido;
import br.com.saude_monitor.api.feedback.document.MedicacaoReceita;
import br.com.saude_monitor.api.feedback.document.MotivoNaoAtendido;
import br.com.saude_monitor.api.feedback.document.TeveMedico;

import java.time.Instant;

/**
 * Resposta de feedback (§3.4 — {@code POST /api/v1/feedbacks} → 201, edição e histórico).
 *
 * <p>{@code hospitalNome} identifica no histórico de qual hospital é a avaliação (nulo na
 * resposta da criação, que é o caminho mais quente e cujo app já mostra o hospital).
 * {@code editavelAte} é o fim do prazo de 15 dias para o dono editar (RN-09); nulo
 * quando a avaliação é anônima e, portanto, não tem dono que possa editá-la.</p>
 */
public record FeedbackResponse(
        String id,
        String visitaId,
        String hospitalId,
        String hospitalNome,
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
        Instant editavelAte,
        boolean recebido
) {
}
