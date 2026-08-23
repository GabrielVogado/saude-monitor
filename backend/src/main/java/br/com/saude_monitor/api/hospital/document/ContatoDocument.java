package br.com.saude_monitor.api.hospital.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Canais de contato do estabelecimento (documento embutido).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContatoDocument {

    private String telefone;
    private String email;
}
