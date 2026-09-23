package br.com.saude_monitor.api.hospital.document;

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
 * Documento MongoDB da coleção {@code sugestoes_hospitais} (Épico 01 — E1-05).
 *
 * <p>Representa uma sugestão pública de hospital ainda não cadastrado, criada por
 * usuário anônimo ou logado. Fica em estado {@link StatusSugestao#PENDENTE} até
 * revisão administrativa — fora do escopo do Épico 01, que apenas registra a
 * pendência.</p>
 *
 * <p>Coleção separada de {@code hospitais} para não poluir o cadastro oficial com
 * dados não validados.</p>
 */
@Document(collection = "sugestoes_hospitais")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SugestaoHospitalDocument {

    @Id
    private String id;

    /** Nome do hospital sugerido. */
    private String nome;

    /** Endereço parcial (logradouro, cidade, UF) informado pelo usuário. */
    private EnderecoDocument endereco;

    /** Observação livre (opcional, até 280 caracteres). */
    private String observacao;

    /** Ciclo de vida da sugestão. Default: PENDENTE. */
    @Builder.Default
    @Indexed
    private StatusSugestao status = StatusSugestao.PENDENTE;

    /** Id do hospital oficial criado a partir da sugestão (quando aprovada). */
    private String hospitalId;

    /** Identificador do administrador que aprovou/rejeitou a sugestão. */
    private String revisadoPor;

    /** Timestamp da decisão administrativa. */
    private Instant revisadoEm;

    /** Motivo da rejeição (obrigatório quando status = RECUSADA). */
    private String motivoRecusa;

    private Instant criadoEm;

    private Instant atualizadoEm;
}
