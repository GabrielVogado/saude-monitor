package br.com.saude_monitor.api.visita.dto;

import br.com.saude_monitor.api.visita.document.OrigemVisita;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

/**
 * Requisição de check-in (entrada) de visita — {@code POST /api/v1/visitas/checkin} (§3.3).
 *
 * <p>{@code posicao} é obrigatória quando {@code origem = GEOFENCE} (validado na camada de
 * serviço via {@code $geoIntersects}); {@code dispositivoId} permite visita anônima (sem login).</p>
 *
 * <p>{@code ocorridoEm} é o momento real da entrada, informado pelo aplicativo quando o
 * check-in foi detectado sem internet e ficou na fila offline (OPS-05): o envio acontece
 * depois, e sem esse campo a visita registraria a hora em que a conexão voltou — o
 * indicador de tempo de permanência passaria a medir a rede do aparelho, não a fila do
 * hospital. É opcional e não confiável por definição (o endpoint é público, OPS-03), por
 * isso a camada de serviço só o aceita dentro de uma janela passada limitada.</p>
 */
public record CheckinRequest(
        @NotBlank String hospitalId,
        @NotNull OrigemVisita origem,
        @Valid PosicaoDto posicao,
        String dispositivoId,
        Instant ocorridoEm
) {
}
