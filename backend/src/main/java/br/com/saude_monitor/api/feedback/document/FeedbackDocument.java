package br.com.saude_monitor.api.feedback.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Documento MongoDB da coleção {@code feedbacks} (Épico 03 — Feedback Pós-Saída).
 *
 * <p>Representa a avaliação curta do usuário sobre o atendimento pós-saída (RN-10).
 * Regras-chave: {@code visitaId} é único (RN-12 dedupe); {@code usuarioId} pode ser
 * nulo (feedback anônimo, RN-13); a nota é 1–5; feedbacks nunca são expostos
 * publicamente (RN-19) — apenas agregados. Ver §2.4 e §3.4 da Especificação da API.</p>
 */
@Document(collection = "feedbacks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@CompoundIndexes({
        @CompoundIndex(name = "idx_hospital_criado", def = "{ 'hospitalId': 1, 'criadoEm': -1 }")
})
public class FeedbackDocument {

    @Id
    private String id;

    /** Visita encerrada à qual este feedback se refere. {@code unique} — RN-12 (dedupe). */
    @Indexed(unique = true)
    private String visitaId;

    /** Dono do feedback. {@code null} para feedback anônimo (RN-13). */
    private String usuarioId;

    private String hospitalId;

    /**
     * Especialidade procurada (lista CNES/DATASUS). Sempre capturada quando triagem = Sim
     * (RN-10), mesmo que não tenha sido atendido — permite indicador de "falta de médico
     * por especialidade".
     */
    private String especialidadeProcurada;

    private FoiAtendido foiAtendido;

    private MotivoNaoAtendido motivoNaoAtendido;

    private TeveMedico teveMedico;

    private FezTriagem fezTriagem;

    private MedicacaoReceita medicacaoReceita;

    /** Nota geral (1–5), obrigatória para o envio (RN-11). */
    private Integer nota;

    /** Comentário opcional, máximo 500 caracteres (RN-10). */
    private String comentario;

    /** Nota de 1 a 5 do tratamento da equipe (Tela 3, opcional). */
    private Integer tratamentoEquipe;

    /** {@code true} quando a identidade do autor foi anonimizada (LGPD). */
    @Builder.Default
    private boolean anonimizado = false;

    private Instant criadoEm;
}
