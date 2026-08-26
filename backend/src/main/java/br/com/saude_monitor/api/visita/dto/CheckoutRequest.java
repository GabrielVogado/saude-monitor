package br.com.saude_monitor.api.visita.dto;

import jakarta.validation.Valid;

/**
 * Requisição de checkout (saída) de visita — {@code POST /api/v1/visitas/{id}/checkout} (§3.3).
 *
 * <p>{@code gpsIndisponivel = true} sinaliza que o dispositivo encerrou a visita após 10min
 * sem sinal de GPS (E2-05/RN-06), sem conseguir confirmar a posição de saída; nesse caso a
 * visita é encerrada com {@code status = GPS_INTERROMPIDO} em vez de {@code FINALIZADA}.</p>
 */
public record CheckoutRequest(
        @Valid PosicaoDto posicao,
        Boolean gpsIndisponivel,
        Boolean encerramentoManual
) {
}
