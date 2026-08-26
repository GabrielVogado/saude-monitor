package br.com.saude_monitor.api.visita.service;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Job agendado de expiração de visitas (E2-03/E2-09): marca {@code SUSPEITA} após 2h sem
 * heartbeat e {@code EXPIRADA} após 24h sem heartbeat (RN-04/RN-23). Executa a cada 15min,
 * conforme §3.3 ({@code POST /api/v1/visitas/{id}/expirar} descreve a mesma regra como job interno).
 */
@Component
@RequiredArgsConstructor
public class VisitaExpiracaoJob {

    private final VisitaService visitaService;

    @Scheduled(fixedRate = 15 * 60 * 1000L)
    public void executar() {
        visitaService.processarExpiracoes();
    }
}
