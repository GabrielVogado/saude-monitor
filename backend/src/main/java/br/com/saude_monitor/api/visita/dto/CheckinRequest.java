package br.com.saude_monitor.api.visita.dto;

import br.com.saude_monitor.api.visita.document.OrigemVisita;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Requisição de check-in (entrada) de visita — {@code POST /api/v1/visitas/checkin} (§3.3).
 *
 * <p>{@code posicao} é obrigatória quando {@code origem = GEOFENCE} (validado na camada de
 * serviço via {@code $geoIntersects}); {@code dispositivoId} permite visita anônima (sem login).</p>
 */
public record CheckinRequest(
        @NotBlank String hospitalId,
        @NotNull OrigemVisita origem,
        @Valid PosicaoDto posicao,
        String dispositivoId
) {
}
