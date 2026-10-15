package br.com.saude_monitor.api.config.security;

import jakarta.validation.constraints.NotEmpty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.util.List;

/**
 * Origens permitidas pelo CORS, lidas do prefixo {@code app.cors} (CORS-01, Épico 7).
 *
 * <p>O app mobile é React Native nativo e nunca sofre CORS — quem precisa destes
 * cabeçalhos é o navegador: o Painel Administrativo Web (Angular, F-11) e a versão
 * web de desenvolvimento do Expo. Sem a origem do painel na lista, o browser bloqueia
 * toda chamada à API já no preflight, a começar pelo login (E7-01).</p>
 *
 * <p>As origens são configuráveis por ambiente ({@code APP_CORS_ALLOWED_ORIGINS}), nunca
 * hard-coded: o padrão em {@code application.properties} cobre só as origens de
 * desenvolvimento (localhost); o deploy de produção sobrescreve com a origem real do
 * painel. Aqui não pode entrar {@code "*"}: com curinga o navegador rejeitaria a
 * combinação com credenciais e, ainda que não rejeitasse, exporia a API a qualquer site.</p>
 *
 * <p>Validada no startup: uma lista vazia (variável de ambiente ausente ou saída vazia
 * do workflow) deixaria o painel inteiro sem acesso à API sem nenhum erro no backend —
 * melhor a aplicação não subir.</p>
 *
 * <p>Registrada automaticamente pelo {@code @ConfigurationPropertiesScan}.</p>
 */
@Validated
@ConfigurationProperties(prefix = "app.cors")
public record CorsProperties(
        /** Origens exatas (esquema://host:porta) autorizadas a chamar a API pelo navegador. */
        @NotEmpty List<String> allowedOrigins
) {
}
