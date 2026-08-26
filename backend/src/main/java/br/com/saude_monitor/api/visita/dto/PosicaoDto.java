package br.com.saude_monitor.api.visita.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Ponto GeoJSON {@code [longitude, latitude]} usado nos payloads de check-in/checkout (§3.3).
 */
public record PosicaoDto(
        @NotNull String type,
        @NotEmpty @Size(min = 2, max = 2) List<Double> coordinates
) {
}
