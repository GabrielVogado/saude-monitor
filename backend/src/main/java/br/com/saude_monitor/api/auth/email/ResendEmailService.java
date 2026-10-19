package br.com.saude_monitor.api.auth.email;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Envio de e-mail via API HTTP do Resend (sem SMTP). Falha de envio (rede, provedor fora,
 * remetente não verificado) é apenas logada — nunca propagada, conforme o contrato de
 * {@link EmailService}.
 *
 * <p>Envio síncrono, dentro da requisição (SOL-09, 18/10/2026). Antes era {@code @Async},
 * para o tempo do "esqueci a senha" não revelar se o e-mail existe; mas no Cloud Run com
 * cobrança por requisição a tarefa em segundo plano fica sem CPU e o código podia atrasar
 * até a próxima requisição, ou se perder. Agora o canal de tempo é fechado pelo piso de
 * resposta ({@code TempoMinimoResposta}) e o envio tem teto: {@link #TIMEOUT_CONEXAO} mais
 * {@link #TIMEOUT_LEITURA}, abaixo do piso. Envio que estoura o teto é registrado em log e
 * o usuário pede outro código.</p>
 */
@Slf4j
@Service
public class ResendEmailService implements EmailService {

    private static final String RESEND_URL = "https://api.resend.com/emails";

    /** Tempo máximo para abrir a conexão com o Resend. */
    static final Duration TIMEOUT_CONEXAO = Duration.ofMillis(500);

    /** Tempo máximo esperando a resposta do Resend. Somado à conexão, fica abaixo do piso de 2 s. */
    static final Duration TIMEOUT_LEITURA = Duration.ofSeconds(1);

    private final RestClient restClient;
    private final String remetente;

    @Autowired
    public ResendEmailService(RestClient.Builder restClientBuilder, ResendProperties properties) {
        this(restClientBuilder.clone(), properties, criarFabricaComTimeout());
    }

    /** {@code fabrica} nula mantém a do builder (os testes ligam um servidor simulado nele). */
    ResendEmailService(RestClient.Builder restClientBuilder, ResendProperties properties,
                       ClientHttpRequestFactory fabrica) {
        if (fabrica != null) {
            restClientBuilder.requestFactory(fabrica);
        }
        this.restClient = restClientBuilder
                .baseUrl(RESEND_URL)
                .defaultHeader("Authorization", "Bearer " + properties.apiKey())
                .build();
        this.remetente = properties.remetente();
    }

    static ClientHttpRequestFactory criarFabricaComTimeout() {
        JdkClientHttpRequestFactory fabrica = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(TIMEOUT_CONEXAO).build());
        fabrica.setReadTimeout(TIMEOUT_LEITURA);
        return fabrica;
    }

    @Override
    public void enviarCodigoRedefinicaoSenha(String destinatario, String codigo) {
        enviar(destinatario, "Código de redefinição de senha", corpoRedefinicao(codigo));
    }

    @Override
    public void enviarCodigoConfirmacaoEmail(String destinatario, String codigo) {
        enviar(destinatario, "Confirme seu e-mail", corpoConfirmacao(codigo));
    }

    private void enviar(String destinatario, String assunto, String corpoHtml) {
        try {
            restClient.post()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "from", remetente,
                            "to", List.of(destinatario),
                            "subject", assunto,
                            "html", corpoHtml
                    ))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RuntimeException ex) {
            log.warn("Falha ao enviar e-mail ('{}') via Resend: {}", assunto, ex.getMessage());
        }
    }

    private String corpoRedefinicao(String codigo) {
        return """
                <p>Use o código abaixo para redefinir sua senha no Saúde Monitor:</p>
                <h2>%s</h2>
                <p>Válido por 15 minutos. Se você não pediu essa redefinição, ignore este e-mail.</p>
                """.formatted(codigo);
    }

    private String corpoConfirmacao(String codigo) {
        return """
                <p>Use o código abaixo para confirmar seu e-mail no Saúde Monitor:</p>
                <h2>%s</h2>
                <p>Válido por 15 minutos. Se você não criou esta conta, ignore este e-mail.</p>
                """.formatted(codigo);
    }
}
