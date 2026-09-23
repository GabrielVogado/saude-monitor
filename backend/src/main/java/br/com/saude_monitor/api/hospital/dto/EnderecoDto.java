package br.com.saude_monitor.api.hospital.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Endereço do estabelecimento (entrada e saída da API).
 *
 * <p>Reutilizado tanto no request (cadastro/edição) quanto no response, já que
 * as anotações de validação não interferem na serialização de saída.</p>
 */
public record EnderecoDto(
        @NotBlank(message = "logradouro é obrigatório")
        @Size(max = 300, message = "logradouro deve ter no máximo 300 caracteres")
        String logradouro,

        String numero,

        String complemento,

        String bairro,

        @NotBlank(message = "cidade é obrigatória")
        @Size(max = 120, message = "cidade deve ter no máximo 120 caracteres")
        String cidade,

        @NotBlank(message = "UF é obrigatória")
        @Size(min = 2, max = 2, message = "UF deve ter exatamente 2 caracteres")
        String uf,

        String cep
) {
}
