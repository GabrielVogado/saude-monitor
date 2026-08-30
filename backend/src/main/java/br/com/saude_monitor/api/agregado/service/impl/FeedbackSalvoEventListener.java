package br.com.saude_monitor.api.agregado.service.impl;

import br.com.saude_monitor.api.agregado.event.FeedbackSalvoEvent;
import br.com.saude_monitor.api.agregado.service.AgregadoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Ouvinte do {@link FeedbackSalvoEvent} (Épico 04): recalcula o agregado do hospital
 * afetado sempre que um feedback é salvo.
 *
 * <p>Usa {@code @Async} para não bloquear o request de criação do feedback e
 * {@code fallbackExecution = true} para garantir a execução mesmo fora de contexto
 * transacional (o save de feedback não é transacional no MVP). Resultado: atualização
 * imediata após cada feedback, caindo para no máximo 15min no job (RN-18).</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FeedbackSalvoEventListener {

    private final AgregadoService agregadoService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void aoSalvarFeedback(FeedbackSalvoEvent evento) {
        try {
            agregadoService.recalcular(evento.hospitalId());
        } catch (Exception ex) {
            // O job de 15min (AgregadoHospitalJob) cobre falhas eventuais; não derruba o request.
            log.warn("Falha ao recalcular agregado após feedback (hospital {}): {}",
                    evento.hospitalId(), ex.getMessage());
        }
    }
}
