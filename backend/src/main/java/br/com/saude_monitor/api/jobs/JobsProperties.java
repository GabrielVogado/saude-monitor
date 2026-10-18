package br.com.saude_monitor.api.jobs;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Disparo dos jobs periódicos (SOL-05).
 *
 * @param agendamentoInterno {@code true} mantém o {@code @Scheduled} dentro da aplicação
 *                           (desenvolvimento e ambientes sem Cloud Scheduler); {@code false}
 *                           deixa o disparo só para {@code POST /internal/jobs/{nome}}
 * @param audiencia          {@code aud} esperado no token OIDC do Cloud Scheduler (a URL do
 *                           serviço); vazio desliga os endpoints internos
 * @param contaServico       e-mail da conta de serviço que o Cloud Scheduler usa; só ela é
 *                           aceita; vazio desliga os endpoints internos
 *
 * <p>Registrada automaticamente pelo {@code @ConfigurationPropertiesScan}.</p>
 */
@ConfigurationProperties(prefix = "app.jobs")
public record JobsProperties(@DefaultValue("true") boolean agendamentoInterno, String audiencia, String contaServico) {

    /** Os endpoints internos só aceitam chamadas quando audiência e conta estão configuradas. */
    public boolean endpointsHabilitados() {
        return audiencia != null && !audiencia.isBlank()
                && contaServico != null && !contaServico.isBlank();
    }
}
