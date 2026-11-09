package br.com.saude_monitor.api.config.security;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.JwsHeader;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.LocatorAdapter;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Chaves HMAC do JWT com identificador ({@code kid}) no cabeçalho, para a troca de chave não
 * derrubar todas as sessões de uma vez (SEG-04).
 *
 * <ul>
 *   <li>Assinatura: a chave ativa, com o {@code kid} dela no cabeçalho; sem chave ativa, a
 *       legada, sem {@code kid} (o comportamento de antes da rotação).</li>
 *   <li>Validação: a chave do {@code kid} do token; sem {@code kid}, a legada. {@code kid}
 *       desconhecido, ou token sem {@code kid} sem chave legada configurada, é token inválido.</li>
 * </ul>
 *
 * <p>Configuração inválida derruba o boot (como no SEG-07): chave com menos de 32 bytes, JSON
 * malformado, {@code kid} fora do padrão, chave ativa fora do mapa ou nenhuma chave para assinar.
 * As mensagens citam o {@code kid}, nunca o segredo.</p>
 */
final class ChavesJwt extends LocatorAdapter<Key> {

    /** HS256 exige chave de pelo menos 256 bits. */
    static final int TAMANHO_MINIMO_BYTES = 32;

    /** Vai no cabeçalho de todo token: só caracteres seguros e tamanho limitado. */
    private static final Pattern FORMATO_KID = Pattern.compile("[A-Za-z0-9._-]{1,64}");

    private final Map<String, SecretKey> porKid;
    private final SecretKey legada;
    private final String kidAtivo;

    private ChavesJwt(Map<String, SecretKey> porKid, SecretKey legada, String kidAtivo) {
        this.porKid = porKid;
        this.legada = legada;
        this.kidAtivo = kidAtivo;
    }

    static ChavesJwt de(JwtProperties properties) {
        SecretKey legada = vazio(properties.secret()) ? null : chave(properties.secret(), "legada (JWT_SECRET)");

        Map<String, SecretKey> porKid = new HashMap<>();
        lerJson(properties.chaves()).forEach((kid, segredo) -> {
            if (kid == null || !FORMATO_KID.matcher(kid).matches()) {
                throw new IllegalStateException("JWT_CHAVES: kid fora do padrão [A-Za-z0-9._-]{1,64}.");
            }
            porKid.put(kid, chave(segredo, "\"" + kid + "\" de JWT_CHAVES"));
        });

        String kidAtivo = vazio(properties.chaveAtiva()) ? null : properties.chaveAtiva().trim();
        if (kidAtivo != null && !porKid.containsKey(kidAtivo)) {
            throw new IllegalStateException("JWT_CHAVE_ATIVA \"" + kidAtivo + "\" não existe em JWT_CHAVES.");
        }
        if (kidAtivo == null && legada == null) {
            throw new IllegalStateException("Nenhuma chave para assinar o JWT: defina JWT_CHAVE_ATIVA ou JWT_SECRET.");
        }
        return new ChavesJwt(Map.copyOf(porKid), legada, kidAtivo);
    }

    /** Kid que vai no cabeçalho dos tokens novos, ou {@code null} quando assina a legada. */
    String kidAtivo() {
        return kidAtivo;
    }

    /** Chave que assina os tokens novos. */
    SecretKey chaveDeAssinatura() {
        return kidAtivo == null ? legada : porKid.get(kidAtivo);
    }

    /** Só JWS: um JWE cai no padrão do {@link LocatorAdapter}, que não devolve chave. */
    @Override
    protected Key locate(JwsHeader header) {
        String kid = header.getKeyId();
        SecretKey chave = kid == null ? legada : porKid.get(kid);
        if (chave == null) {
            // Sem o kid na mensagem: o valor vem do token, que qualquer um monta.
            throw new JwtException("Token assinado com chave desconhecida.");
        }
        return chave;
    }

    private static Map<String, String> lerJson(String json) {
        if (vazio(json)) {
            return Map.of();
        }
        try {
            Map<String, String> chaves = new ObjectMapper().readValue(json, new TypeReference<>() {
            });
            return chaves == null ? Map.of() : chaves;
        } catch (JsonProcessingException _) {
            // A causa não vai junto: a mensagem do Jackson pode trazer trechos do segredo.
            throw new IllegalStateException("JWT_CHAVES não é um JSON {\"kid\": \"segredo\"} válido.");
        }
    }

    private static SecretKey chave(String segredo, String nome) {
        byte[] bytes = segredo == null ? new byte[0] : segredo.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < TAMANHO_MINIMO_BYTES) {
            throw new IllegalStateException("Chave JWT " + nome + " com menos de "
                    + TAMANHO_MINIMO_BYTES + " bytes.");
        }
        return Keys.hmacShaKeyFor(bytes);
    }

    private static boolean vazio(String valor) {
        return valor == null || valor.isBlank();
    }
}
