package br.com.saude_monitor.api.config.security;

import br.com.saude_monitor.api.user.document.UserDocument;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Rotação da chave do JWT por {@code kid} (SEG-04): token assinado com chave antiga ainda
 * publicada é aceito, {@code kid} desconhecido é recusado, token legado (sem {@code kid}) vale
 * enquanto a chave legada estiver configurada, e configuração inválida derruba o boot.
 */
class JwtServiceRotacaoChaveTest {

    private static final long ACCESS_MS = 900_000L;
    private static final long REFRESH_MS = 2_592_000_000L;

    private static final String LEGADA = "segredo-legado-de-teste-com-32-bytes-ou-mais";
    private static final String CHAVE_K1 = "segredo-da-chave-k1-de-teste-com-32-bytes";
    private static final String CHAVE_K2 = "segredo-da-chave-k2-de-teste-com-32-bytes";

    private static final String EMAIL = "pessoa@email.com";

    private static JwtService servico(String legada, String chavesJson, String ativa) {
        return new JwtService(new JwtProperties(legada, ACCESS_MS, REFRESH_MS, chavesJson, ativa));
    }

    private static UserDocument usuario() {
        UserDocument usuario = new UserDocument();
        usuario.setEmail(EMAIL);
        return usuario;
    }

    private static String kidDoCabecalho(String token) {
        String cabecalho = new String(Base64.getUrlDecoder().decode(token.split("\\.")[0]),
                StandardCharsets.UTF_8);
        return cabecalho.contains("\"kid\"") ? cabecalho.replaceAll(".*\"kid\":\"([^\"]+)\".*", "$1") : null;
    }

    /** Access token montado à mão, para simular quem tem (ou inventa) uma chave. */
    private static String accessAssinadoCom(String segredo, String kid) {
        var builder = Jwts.builder();
        if (kid != null) {
            builder.header().keyId(kid);
        }
        Instant agora = Instant.now();
        return builder
                .id(UUID.randomUUID().toString())
                .subject(EMAIL)
                .claim("type", "access")
                .issuedAt(Date.from(agora))
                .expiration(Date.from(agora.plusMillis(ACCESS_MS)))
                .signWith(Keys.hmacShaKeyFor(segredo.getBytes(StandardCharsets.UTF_8)))
                .compact();
    }

    @Test
    void semChaveAtivaAssinaComALegadaSemKidComoAntes() {
        JwtService jwt = servico(LEGADA, null, null);

        String token = jwt.generateAccessToken(usuario());

        assertThat(kidDoCabecalho(token)).isNull();
        assertThat(jwt.isAccessTokenValid(token, EMAIL)).isTrue();
    }

    @Test
    void comChaveAtivaOTokenLevaOKidDelaNoCabecalho() {
        JwtService jwt = servico(LEGADA, "{\"k1\":\"" + CHAVE_K1 + "\"}", "k1");

        String access = jwt.generateAccessToken(usuario());
        String refresh = jwt.generateRefreshToken(usuario());

        assertThat(kidDoCabecalho(access)).isEqualTo("k1");
        assertThat(jwt.isAccessTokenValid(access, EMAIL)).isTrue();
        assertThat(jwt.isRefreshTokenValid(refresh)).isTrue();
        assertThat(jwt.extractEmail(refresh)).isEqualTo(EMAIL);
    }

    @Test
    void depoisDaRotacaoTokenComKidVelhoAindaPublicadoContinuaAceito() {
        JwtService antes = servico(LEGADA, "{\"k1\":\"" + CHAVE_K1 + "\"}", "k1");
        String refreshAntigo = antes.generateRefreshToken(usuario());

        JwtService depois = servico(LEGADA, "{\"k1\":\"" + CHAVE_K1 + "\",\"k2\":\"" + CHAVE_K2 + "\"}", "k2");

        assertThat(depois.isRefreshTokenValid(refreshAntigo)).isTrue();
        assertThat(depois.extractJti(refreshAntigo)).isEqualTo(antes.extractJti(refreshAntigo));
        assertThat(kidDoCabecalho(depois.generateAccessToken(usuario()))).isEqualTo("k2");
    }

    @Test
    void chaveRetiradaDoMapaInvalidaOsTokensDela() {
        String tokenK1 = servico(LEGADA, "{\"k1\":\"" + CHAVE_K1 + "\"}", "k1").generateAccessToken(usuario());

        JwtService semK1 = servico(LEGADA, "{\"k2\":\"" + CHAVE_K2 + "\"}", "k2");

        assertThat(semK1.isAccessTokenValid(tokenK1, EMAIL)).isFalse();
        assertThat(semK1.extrairAssuntoDoAccessToken(tokenK1)).isEmpty();
    }

    @Test
    void kidDesconhecidoERecusadoMesmoComAssinaturaDaLegada() {
        JwtService jwt = servico(LEGADA, "{\"k1\":\"" + CHAVE_K1 + "\"}", "k1");

        // Quem conhece a legada não consegue escapar dela inventando um kid.
        assertThat(jwt.isAccessTokenValid(accessAssinadoCom(LEGADA, "k9"), EMAIL)).isFalse();
        assertThat(jwt.isAccessTokenValid(accessAssinadoCom(CHAVE_K1, "k9"), EMAIL)).isFalse();
    }

    @Test
    void kidConhecidoComOutraChaveERecusado() {
        JwtService jwt = servico(LEGADA, "{\"k1\":\"" + CHAVE_K1 + "\"}", "k1");

        assertThat(jwt.isAccessTokenValid(accessAssinadoCom(LEGADA, "k1"), EMAIL)).isFalse();
        assertThat(jwt.isAccessTokenValid(accessAssinadoCom(CHAVE_K2, "k1"), EMAIL)).isFalse();
    }

    @Test
    void tokenSemAssinaturaERecusado() {
        JwtService jwt = servico(LEGADA, "{\"k1\":\"" + CHAVE_K1 + "\"}", "k1");
        Instant agora = Instant.now();
        var builder = Jwts.builder();
        builder.header().keyId("k1");
        String semAssinatura = builder
                .subject(EMAIL)
                .claim("type", "access")
                .expiration(Date.from(agora.plusMillis(ACCESS_MS)))
                .compact();

        assertThat(jwt.isAccessTokenValid(semAssinatura, EMAIL)).isFalse();
    }

    @Test
    void tokenLegadoEAceitoEnquantoALegadaEstiverConfigurada() {
        String legado = servico(LEGADA, null, null).generateRefreshToken(usuario());

        JwtService rotacionado = servico(LEGADA, "{\"k1\":\"" + CHAVE_K1 + "\"}", "k1");

        assertThat(rotacionado.isRefreshTokenValid(legado)).isTrue();
    }

    @Test
    void tokenLegadoERecusadoDepoisDaRetiradaDaLegada() {
        String legado = servico(LEGADA, null, null).generateAccessToken(usuario());

        JwtService semLegada = servico(null, "{\"k1\":\"" + CHAVE_K1 + "\"}", "k1");

        assertThat(semLegada.isAccessTokenValid(legado, EMAIL)).isFalse();
        assertThat(semLegada.isAccessTokenValid(accessAssinadoCom(CHAVE_K1, null), EMAIL)).isFalse();
    }

    @Test
    void chavePublicadaSemAtivarSoValida() {
        // Passo 1 da rotação: a k1 entra no mapa, mas a legada segue assinando.
        JwtService publicada = servico(LEGADA, "{\"k1\":\"" + CHAVE_K1 + "\"}", null);

        assertThat(kidDoCabecalho(publicada.generateAccessToken(usuario()))).isNull();
        assertThat(publicada.isAccessTokenValid(accessAssinadoCom(CHAVE_K1, "k1"), EMAIL)).isTrue();
    }

    // ---------------------------------------------------------------------
    // Validação de inicialização: configuração inválida derruba o boot
    // ---------------------------------------------------------------------

    @Test
    void chaveComMenosDe32BytesDerrubaOBoot() {
        assertThatThrownBy(() -> servico(LEGADA, "{\"k1\":\"curta-demais\"}", "k1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("\"k1\"")
                .hasMessageNotContaining("curta-demais");
        assertThatThrownBy(() -> servico("curta", null, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("legada");
    }

    @Test
    void chaveAtivaForaDoMapaDerrubaOBoot() {
        assertThatThrownBy(() -> servico(LEGADA, "{\"k1\":\"" + CHAVE_K1 + "\"}", "k2"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("k2");
    }

    @Test
    void semNenhumaChaveParaAssinarDerrubaOBoot() {
        assertThatThrownBy(() -> servico(" ", "{\"k1\":\"" + CHAVE_K1 + "\"}", ""))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void jsonMalformadoDerrubaOBootSemExporOSegredo() {
        assertThatThrownBy(() -> servico(LEGADA, "{\"k1\":\"" + CHAVE_K1 + "\"", "k1"))
                .isInstanceOf(IllegalStateException.class)
                .hasNoCause()
                .hasMessageNotContaining(CHAVE_K1);
    }

    @Test
    void kidForaDoPadraoDerrubaOBoot() {
        assertThatThrownBy(() -> servico(LEGADA, "{\"k 1\\\"\":\"" + CHAVE_K1 + "\"}", null))
                .isInstanceOf(IllegalStateException.class);
    }
}
