package br.com.saude_monitor.api.configuracao.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Configuração remota da operação (ARQ-09), na coleção {@code configuracao_remota}.
 *
 * <p>Há um documento só, de {@code _id} {@value #ID_UNICO}. Sem ele, valem os padrões: tudo
 * liberado e nenhuma versão mínima.</p>
 */
@Document(collection = "configuracao_remota")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConfiguracaoRemotaDocument {

    /** Identificador do único documento da coleção. */
    public static final String ID_UNICO = "atual";

    @Id
    private String id;

    /** Recusa gravações dos usuários (503 {@code MODO_SOMENTE_LEITURA}); consultas seguem. */
    private boolean modoSomenteLeitura;

    /** Menor versão do app ainda aceita (ex.: {@code 1.0.0}); {@code null} aceita qualquer uma. */
    private String versaoMinimaApp;

    /** Texto opcional mostrado no app durante o modo somente leitura. */
    private String mensagem;

    private Instant atualizadoEm;

    /** Id do administrador que fez a última alteração. */
    private String atualizadoPor;
}
