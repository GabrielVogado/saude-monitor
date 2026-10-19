package br.com.saude_monitor.api.visita.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Job agendado de recuperação de visitas com GPS interrompido (E2-05/RN-06): encerra como
 * {@code GPS_INTERROMPIDO} toda visita {@code EM_ATENDIMENTO} sem sinal de posição/heartbeat
 * por 45 minutos. Executa a cada 15min, mesmo padrão de {@link VisitaExpiracaoJob}.
 */
@Component
@RequiredArgsConstructor
public class VisitaGpsInterrompidoJob {

    private final VisitaService visitaService;

    public void executar() {
        visitaService.processarGpsInterrompido();
    }
}
