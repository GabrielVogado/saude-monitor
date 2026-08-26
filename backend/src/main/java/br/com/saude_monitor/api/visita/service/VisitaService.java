package br.com.saude_monitor.api.visita.service;

import br.com.saude_monitor.api.hospital.dto.PageResponse;
import br.com.saude_monitor.api.visita.dto.CheckinRequest;
import br.com.saude_monitor.api.visita.dto.CheckinResponse;
import br.com.saude_monitor.api.visita.dto.CheckoutRequest;
import br.com.saude_monitor.api.visita.dto.CheckoutResponse;
import br.com.saude_monitor.api.visita.dto.HeartbeatResponse;
import br.com.saude_monitor.api.visita.dto.PosicaoDto;
import br.com.saude_monitor.api.visita.dto.TipoPermanenciaRequest;
import br.com.saude_monitor.api.visita.dto.TipoPermanenciaResponse;
import br.com.saude_monitor.api.visita.dto.VisitaAtivaResponse;
import br.com.saude_monitor.api.visita.dto.VisitaResponse;

/**
 * Serviço de detecção e ciclo de vida de visitas (Épico 02).
 */
public interface VisitaService {

    CheckinResponse checkin(CheckinRequest request, String usuarioId);

    CheckoutResponse checkout(String id, CheckoutRequest request, String usuarioId);

    HeartbeatResponse heartbeat(String id, String usuarioId, PosicaoDto posicao);

    TipoPermanenciaResponse sinalizarTipoPermanencia(String id, TipoPermanenciaRequest request, String usuarioId);

    VisitaAtivaResponse buscarAtiva(String usuarioId);

    PageResponse<VisitaResponse> historico(String usuarioId, int page, int size);

    /** Job periódico: marca SUSPEITA (2h sem heartbeat) e EXPIRADA (24h sem heartbeat) — E2-03/E2-09. */
    void processarExpiracoes();

    /** Job periódico: encerra visitas ativas sem sinal de posição por 10min como GPS_INTERROMPIDO — E2-05/RN-06. */
    void processarGpsInterrompido();
}
