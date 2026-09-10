package br.com.saude_monitor.api.auth.email;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Envio de e-mail via API HTTP do Resend (sem SMTP). Falha de envio (rede, provedor fora,
 * remetente não verificado) é apenas logada — nunca propagada, conforme o contrato de
 * {@link EmailService}.
 *
 * <p>{@code @Async} (achado do code-review, 10/09/2026): sem isto, a chamada HTTP síncrona
 * ao Resend ficava no caminho de resposta de {@code esqueciSenha}, tornando o tempo de
 * resposta um canal lateral — "e-mail existe" (BCrypt + Mongo + rede externa) media
 * visivelmente mais que "e-mail não existe" (só a consulta), mesmo com o corpo da resposta
 * idêntico. `@EnableAsync` já ativo na aplicação (mesmo padrão de
 * {@code FeedbackSalvoEventListener}).</p>
 */
@Slf4j
@Service
public class ResendEmailService implements EmailService {

    private static final String RESEND_URL = "https://api.resend.com/emails";

    private final RestClient restClient;
    private final String remetente;

    public ResendEmailService(RestClient.Builder restClientBuilder, ResendProperties properties) {
        this.restClient = restClientBuilder
                .baseUrl(RESEND_URL)
                .defaultHeader("Authorization", "Bearer " + properties.apiKey())
                .build();
        this.remetente = properties.remetente();
    }

    @Override
    public void enviarCodigoRedefinicaoSenha(String destinatario, String codigo) {
        try {
            restClient.post()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "from", remetente,
                            "to", List.of(destinatario),
                            "subject", "Código de redefinição de senha",
                            "html", corpoHtml(codigo)
                    ))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RuntimeException ex) {
            log.warn("Falha ao enviar e-mail de redefinição de senha via Resend: {}", ex.getMessage());
        }
    }

    private String corpoHtml(String codigo) {
        return """
                <p>Use o código abaixo para redefinir sua senha no Saúde Monitor:</p>
                <h2>%s</h2>
                <p>Válido por 15 minutos. Se você não pediu essa redefinição, ignore este e-mail.</p>
                """.formatted(codigo);
    }
}
