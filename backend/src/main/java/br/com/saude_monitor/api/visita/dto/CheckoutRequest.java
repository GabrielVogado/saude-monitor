package br.com.saude_monitor.api.visita.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/**
 * Requisição de checkout (saída) de visita — {@code POST /api/v1/visitas/{id}/checkout} (§3.3).
 *
 * <p>{@code gpsIndisponivel = true} sinaliza que o dispositivo encerrou a visita sem sinal
 * de GPS (E2-05/RN-06), sem conseguir confirmar a posição de saída; nesse caso a
 * visita é encerrada com {@code status = GPS_INTERROMPIDO} em vez de {@code FINALIZADA}.</p>
 *
 * <p>{@code ocorridoEm} é o momento real da saída, usado quando o checkout ficou na fila
 * offline do aplicativo (OPS-05). Ver {@link CheckinRequest} para as restrições.</p>
 *
 * <p>{@code dispositivoId} é obrigatório para encerrar visita anônima: é a prova de que quem
 * chama é o aparelho que fez o check-in (SEG-02). Ignorado em visita de usuário logado.</p>
 */
public record CheckoutRequest(
        @Valid PosicaoDto posicao,
        Boolean gpsIndisponivel,
        Boolean encerramentoManual,
        Instant ocorridoEm,
        @Size(max = 64, message = "dispositivoId deve ter no máximo 64 caracteres.")
        String dispositivoId
) {
}
