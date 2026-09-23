package br.com.saude_monitor.api.feedback.dto;

import br.com.saude_monitor.api.feedback.document.FezTriagem;
import br.com.saude_monitor.api.feedback.document.FoiAtendido;
import br.com.saude_monitor.api.feedback.document.MedicacaoReceita;
import br.com.saude_monitor.api.feedback.document.TeveMedico;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Payload de criação de feedback (Épico 03 — §3.4 {@code POST /api/v1/feedbacks}).
 *
 * <p>Contrato alinhado à Especificação da API v2.0. {@code nota} (1–5) é obrigatória
 * (RN-11); demais perguntas são opcionais/puláveis (RN-11).</p>
 */
public record FeedbackRequest(
        @NotBlank(message = "visitaId é obrigatório.")
        String visitaId,

        FoiAtendido foiAtendido,

        /**
         * Motivo do não atendimento, aceito como texto livre para permitir que o frontend
         * envie o label amigável {@code CASOS_MAIS_GRAVES_PRIORIDADE} (normalizado pelo
         * backend para {@code CLASSIFICACAO_RISCO}) — F-05/RN-10.
         */
        String motivoNaoAtendido,

        TeveMedico teveMedico,

        FezTriagem fezTriagem,

        MedicacaoReceita medicacaoReceita,

        String especialidadeProcurada,

        @Min(value = 1, message = "nota deve ser entre 1 e 5.")
        @Max(value = 5, message = "nota deve ser entre 1 e 5.")
        @NotNull(message = "nota é obrigatória para o envio.")
        Integer nota,

        @Min(value = 1, message = "tratamentoEquipe deve ser entre 1 e 5.")
        @Max(value = 5, message = "tratamentoEquipe deve ser entre 1 e 5.")
        Integer tratamentoEquipe,

        @Size(max = 500, message = "comentario deve ter no máximo 500 caracteres.")
        String comentario
) {
}
