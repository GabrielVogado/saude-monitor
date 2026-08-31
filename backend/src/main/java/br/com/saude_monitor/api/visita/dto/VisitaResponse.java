package br.com.saude_monitor.api.visita.dto;

import br.com.saude_monitor.api.visita.document.OrigemVisita;
import br.com.saude_monitor.api.visita.document.StatusVisita;
import br.com.saude_monitor.api.visita.document.TipoPermanencia;

import java.time.Instant;

/**
 * Representação completa de uma visita, usada no card de visita ativa e no histórico (§3.3).
 * {@code visitaValida} é {@code false} quando {@code duracaoMinutos < 2} (RN-07/E2-08): a visita
 * permanece no histórico do usuário, mas é excluída das estatísticas públicas (agregação, Épico 04).
 *
 * {@code hospitalNome} (nome de exibição do hospital) é preenchido apenas no histórico do usuário
 * (E5-03/RN-22 — "visita + hospital"), conforme Especificacao-API-v2.0 §3.5. No card de visita ativa
 * ele permanece {@code null}, pois o detalhe já busca o hospital.
 */
public record VisitaResponse(
        String id,
        String usuarioId,
        String hospitalId,
        String hospitalNome,
        Instant entrada,
        Instant saida,
        Integer duracaoMinutos,
        StatusVisita status,
        TipoPermanencia tipoPermanencia,
        Instant ultimoHeartbeat,
        OrigemVisita origem,
        Instant criadoEm,
        boolean visitaValida
) {
}

