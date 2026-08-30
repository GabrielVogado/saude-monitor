package br.com.saude_monitor.api.agregado.service;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Job agendado de atualização dos agregados de indicadores (Épico 04, RN-18).
 *
 * <p>Roda a cada 15 minutos, mesmo padrão dos demais jobs do sistema
 * ({@code FeedbackSemRespostaJob}, {@code VisitaExpiracaoJob}), garantindo que a
 * atualização pública dos indicadores ocorra em até 15min após um feedback
 * (caminho de baixa latência = evento {@code FeedbackSalvoEvent}; este job é a rede
 * de segurança em lote).</p>
 */
@Component
@RequiredArgsConstructor
public class AgregadoHospitalJob {

    private final AgregadoService agregadoService;

    @Scheduled(fixedRate = 15 * 60 * 1000L)
    public void executar() {
        agregadoService.recalcularPendentes();
    }
}
