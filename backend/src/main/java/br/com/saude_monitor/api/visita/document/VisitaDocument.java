package br.com.saude_monitor.api.visita.document;

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
import java.util.ArrayList;
import java.util.List;

/**
 * Documento MongoDB da coleção {@code visitas} (Épico 02 — Detecção de Visitas/Geofence).
 *
 * <p>Representa o ciclo de vida de uma permanência de um usuário (ou dispositivo anônimo,
 * via {@link #dispositivoId}) dentro do geofence de um hospital, desde a entrada
 * ({@link StatusVisita#EM_ATENDIMENTO}) até o encerramento (checkout, expiração por
 * ausência de heartbeat, ou interrupção de GPS). Ver §2.3 da Especificação da API e
 * as histórias E2-01..E2-10 do Backlog.</p>
 */
@Document(collection = "visitas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@CompoundIndexes({
        @CompoundIndex(name = "idx_hospital_entrada", def = "{ 'hospitalId': 1, 'entrada': -1 }"),
        @CompoundIndex(name = "idx_usuario_entrada", def = "{ 'usuarioId': 1, 'entrada': -1 }")
})
public class VisitaDocument {

    @Id
    private String id;

    /** Usuário autenticado dono da visita. {@code null} para visita anônima (ver {@link #dispositivoId}). */
    private String usuarioId;

    /** Identificador do dispositivo, usado para visitas sem login (RN-05, §3.3). */
    private String dispositivoId;

    private String hospitalId;

    private Instant entrada;

    private Instant saida;

    private Integer duracaoMinutos;

    @Indexed
    @Builder.Default
    private StatusVisita status = StatusVisita.EM_ATENDIMENTO;

    @Builder.Default
    private TipoPermanencia tipoPermanencia = TipoPermanencia.ATENDIMENTO;

    /** Último sinal de vida da visita (RN-23), usado pelo job de expiração (E2-03/E2-09). */
    @Indexed
    private Instant ultimoHeartbeat;

    /** Último evento de posição recebido (checkin/checkout/heartbeat com posição) — usado pelo job de GPS interrompido (E2-05/RN-06). */
    @Indexed
    private Instant ultimaPosicaoEm;

    /** {@code true} quando a visita foi encerrada manualmente pelo usuário (botão "Não estou aqui", E2-07/F-04 CA#3). */
    private Boolean encerramentoManual;

    private OrigemVisita origem;

    @Builder.Default
    private List<PontoAmostralDocument> pontosAmostrais = new ArrayList<>();

    /** Anotações de auditoria (ex.: "entrada detectada em 3min; saída em 6min"). */
    private String notas;

    private Instant criadoEm;
}
