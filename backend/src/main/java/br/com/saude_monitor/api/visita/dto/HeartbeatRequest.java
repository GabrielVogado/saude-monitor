package br.com.saude_monitor.api.visita.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

/**
 * Requisição de heartbeat (E2-09/RN-23). {@code posicao} é opcional: quando presente, também
 * atualiza {@code ultimaPosicaoEm} e registra um ponto amostral, servindo de sinal de GPS
 * ativo para o job de interrupção (E2-05/RN-06).
 *
 * <p>{@code dispositivoId} é obrigatório em visita anônima, como no checkout (SEG-02).</p>
 */
public record HeartbeatRequest(
        @Valid PosicaoDto posicao,
        @Size(max = 64, message = "dispositivoId deve ter no máximo 64 caracteres.")
        String dispositivoId
) {
}
