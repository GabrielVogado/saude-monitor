package br.com.saude_monitor.api.config.security;

import br.com.saude_monitor.api.user.document.UserDocument;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

/**
 * Emissão e validação de tokens JWT (F0-01).
 *
 * <p>Dois tipos de token, distinguidos pelo claim {@code type}:</p>
 * <ul>
 *   <li>{@code access} — 15 min, usado na autorização de requisições;</li>
 *   <li>{@code refresh} — 30 dias, usado apenas para renovar o access (com rotação).</li>
 * </ul>
 *
 * <p>Assinatura HS256 com chave simétrica derivada de {@link JwtProperties#secret()}.</p>
 */
@Service
public class JwtService {

    private static final String CLAIM_TYPE = "type";
    private static final String CLAIM_USER_ID = "userId";
    private static final String CLAIM_PAPEL = "papel";
    private static final String TYPE_ACCESS = "access";
    private static final String TYPE_REFRESH = "refresh";

    private final JwtProperties properties;
    private final SecretKey key;

    public JwtService(JwtProperties properties) {
        this.properties = properties;
        this.key = Keys.hmacShaKeyFor(properties.secret().getBytes(StandardCharsets.UTF_8));
    }

    /** Gera um access token (15 min) para o usuário. */
    public String generateAccessToken(UserDocument user) {
        return buildToken(user, properties.accessExpirationMs(), TYPE_ACCESS);
    }

    /** Gera um refresh token (30 dias) para o usuário. */
    public String generateRefreshToken(UserDocument user) {
        return buildToken(user, properties.refreshExpirationMs(), TYPE_REFRESH);
    }

    /** Validade do access token em segundos (campo {@code expiraEm} da resposta). */
    public long accessExpirationSeconds() {
        return properties.accessExpirationMs() / 1000;
    }

    /** Extrai o subject (e-mail) do token, sem validar assinatura/expiracao. */
    public String extractEmail(String token) {
        return extractAllClaims(token).getSubject();
    }

    /** True se o token é um access token válido (assinatura, tipo e expiração) para o e-mail. */
    public boolean isAccessTokenValid(String token, String email) {
        try {
            Claims claims = extractAllClaims(token);
            return TYPE_ACCESS.equals(claims.get(CLAIM_TYPE, String.class))
                    && email.equals(claims.getSubject())
                    && claims.getExpiration().after(new Date());
        } catch (RuntimeException ex) {
            return false;
        }
    }

    /** True se o token é um refresh token válido (assinatura, tipo e expiração). */
    public boolean isRefreshTokenValid(String token) {
        try {
            Claims claims = extractAllClaims(token);
            return TYPE_REFRESH.equals(claims.get(CLAIM_TYPE, String.class))
                    && claims.getExpiration().after(new Date());
        } catch (RuntimeException ex) {
            return false;
        }
    }

    private String buildToken(UserDocument user, long expirationMs, String type) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(user.getEmail())
                .claim(CLAIM_USER_ID, user.getId())
                .claim(CLAIM_PAPEL, user.getPapel() == null ? "USER" : user.getPapel().name())
                .claim(CLAIM_TYPE, type)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusMillis(expirationMs)))
                .signWith(key)
                .compact();
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
