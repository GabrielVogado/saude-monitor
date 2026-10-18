package br.com.saude_monitor.api.indicador.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Job agendado de atualização dos indicadores (Épico 04, RN-18).
 *
 * <p>Roda a cada 15 minutos, mesmo padrão dos demais jobs do sistema
 * ({@code FeedbackSemRespostaJob}, {@code VisitaExpiracaoJob}), garantindo que a
 * atualização pública dos indicadores ocorra em até 15min após um feedback
 * (caminho de baixa latência = evento {@code FeedbackSalvoEvent}; este job é a rede
 * de segurança em lote).</p>
 */
@Component
@RequiredArgsConstructor
public class IndicadorHospitalJob {

    private final IndicadorService indicadorService;

    public void executar() {
        indicadorService.recalcularPendentes();
    }
}
