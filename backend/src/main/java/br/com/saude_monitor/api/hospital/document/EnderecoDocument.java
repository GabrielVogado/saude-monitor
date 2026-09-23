package br.com.saude_monitor.api.hospital.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Endereço do estabelecimento (documento embutido na coleção {@code hospitais}).
 *
 * <p>Campos em pt-BR conforme a Especificação da API v2.0 (§2.1).</p>
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EnderecoDocument {

    private String logradouro;
    private String numero;
    private String complemento;
    private String bairro;
    private String cidade;
    private String uf;
    private String cep;
}
