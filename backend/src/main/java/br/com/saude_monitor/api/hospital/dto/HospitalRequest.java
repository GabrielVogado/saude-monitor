package br.com.saude_monitor.api.hospital.dto;

import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Payload de cadastro/edição de hospital (Épico 01).
 */
public record HospitalRequest(
        @NotBlank(message = "nome é obrigatório")
        @Size(max = 200, message = "nome deve ter no máximo 200 caracteres")
        String nome,

        /** CNPJ opcional; quando informado, deve seguir o formato XX.XXX.XXX/XXXX-XX. */
        @Pattern(regexp = "^\\d{2}\\.\\d{3}\\.\\d{3}/\\d{4}-\\d{2}$",
                message = "CNPJ deve estar no formato XX.XXX.XXX/XXXX-XX")
        String cnpj,

        @NotNull(message = "tipo é obrigatório")
        TipoEstabelecimento tipo,

        CategoriaEstabelecimento categoria,

        @Valid
        @NotNull(message = "endereco é obrigatório")
        EnderecoDto endereco,

        @Valid
        ContatoDto contato,

        @NotNull(message = "geofence é obrigatório")
        GeoJsonPolygonDto geofence
) {
}
