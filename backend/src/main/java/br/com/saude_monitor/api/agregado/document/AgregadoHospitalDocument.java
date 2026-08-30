package br.com.saude_monitor.api.agregado.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Documento MongoDB da coleção {@code agregados_hospitais} (Épico 04 — Indicadores Públicos).
 *
 * <p>Armazena o agregado materializado por hospital (média de notas, mediana de tempo,
 * contagens e janela do período considerada). É um documento de <em>leitura pública</em>
 * (RN-19): jamais contém dados individuais de feedbacks/visitas, apenas estatísticas.</p>
 *
 * <p>Regras (RN-14..RN-17, §2.5 da Especificação da API): {@code notaMedia} = média
 * aritmética das notas dos feedbacks válidos no período; {@code tempoMedianoMinutos} =
 * mediana das durações de visitas FINALIZADA com {@code tipoPermanencia = ATENDIMENTO}
 * e ≤ 24h; visitas {@code GPS_INTERROMPIDO} entram apenas se o tempo parcial for
 * confiável (≥ 90% do período coberto).</p>
 *
 * <p>O documento é gravado (upsert) por {@code hospitalId} — índice único — a cada
 * recálculo (evento de feedback + job de 15min, RN-18).</p>
 */
@Document(collection = "agregados_hospitais")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgregadoHospitalDocument {

    @Id
    private String id;

    /** Hospital dono do agregado. Índice único — um agregado por hospital (§2.5). */
    @Indexed(unique = true)
    private String hospitalId;

    /** Média aritmética das notas (1–5) dos feedbacks válidos no período (RN-14). */
    private Double notaMedia;

    /** Número de avaliações (feedbacks) consideradas (RN-15 — exibir apenas se ≥ 5). */
    private Integer nAvaliacoes;

    /** Mediana das durações das visitas elegíveis no período, em minutos (RN-16). */
    private Integer tempoMedianoMinutos;

    /** Número de visitas elegíveis consideradas no cálculo do tempo (RN-16/R-17). */
    private Integer nVisitas;

    /** Início (inclusivo) da janela do período de cálculo (padrão: últimos 90 dias). */
    private Instant periodoInicio;

    /** Fim (inclusivo) da janela do período de cálculo. */
    private Instant periodoFim;

    /** Momento do último recálculo (RN-18/R-19 — "Atualizado em …"). */
    private Instant atualizadoEm;
}
