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

    /**
     * Prazo em que visita e feedback ficam ligados a quem os fez (DAD-01 B). Depois dele
     * perdem conta e aparelho, como promete o Documento Negocial v2.1 §11 ("dados de
     * localização agregados sem vínculo pessoal após 90 dias").
     */
    java.time.Duration PRAZO_VINCULO_PESSOAL = java.time.Duration.ofDays(90);

    CheckinResponse checkin(CheckinRequest request, String usuarioId);

    CheckoutResponse checkout(String id, CheckoutRequest request, String usuarioId);

    HeartbeatResponse heartbeat(String id, String usuarioId, String dispositivoId, PosicaoDto posicao);

    TipoPermanenciaResponse sinalizarTipoPermanencia(String id, TipoPermanenciaRequest request, String usuarioId);

    VisitaAtivaResponse buscarAtiva(String usuarioId, String dispositivoId);

    PageResponse<VisitaResponse> historico(String usuarioId, int page, int size);

    /** Job periódico: marca SUSPEITA (2h sem heartbeat) e EXPIRADA (24h sem heartbeat) — E2-03/E2-09. */
    void processarExpiracoes();

    /** Job periódico: encerra visitas ativas sem sinal de posição por 45min como GPS_INTERROMPIDO — E2-05/RN-06. */
    void processarGpsInterrompido();

    /**
     * Apaga os pontos de GPS que tenham sobrado em visitas já encerradas (DAD-01). Devolve
     * quantas visitas mudaram.
     */
    long apagarPontosDeVisitasEncerradas();

    /**
     * Desvincula de conta e aparelho as visitas com mais de 90 dias e apaga os pontos de
     * GPS que tenham sobrado (DAD-01). Devolve quantas visitas mudaram.
     */
    long desvincularVisitasAntigas();
}
