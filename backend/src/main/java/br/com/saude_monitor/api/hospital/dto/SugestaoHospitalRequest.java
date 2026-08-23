package br.com.saude_monitor.api.hospital.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Contrato de entrada da sugestão pública de hospital (E1-05).
 *
 * <p>Compatível com o contrato assumido no frontend (Renata):
 * {@code { nome, endereco: { logradouro, cidade, uf }, observacao }}.</p>
 */
public record SugestaoHospitalRequest(
        @NotBlank(message = "nome é obrigatório")
        @Size(max = 200, message = "nome deve ter no máximo 200 caracteres")
        String nome,

        @Valid
        @NotNull(message = "endereco é obrigatório")
        EnderecoDto endereco,

        @Size(max = 280, message = "observacao deve ter no máximo 280 caracteres")
        String observacao
) {
}
