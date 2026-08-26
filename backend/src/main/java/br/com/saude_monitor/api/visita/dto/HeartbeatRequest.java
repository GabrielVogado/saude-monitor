package br.com.saude_monitor.api.visita.dto;

import jakarta.validation.Valid;

/**
 * Requisição de heartbeat (E2-09/RN-23). {@code posicao} é opcional: quando presente, também
 * atualiza {@code ultimaPosicaoEm} e registra um ponto amostral, servindo de sinal de GPS
 * ativo para o job de interrupção (E2-05/RN-06).
 */
public record HeartbeatRequest(
        @Valid PosicaoDto posicao
) {
}
