package br.com.saude_monitor.api.auth.revogacao;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.TypeAlias;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Refresh token revogado (coleção {@code refresh_tokens_revogados}) — blacklist corta (F0-02 / §3.1).
 *
 * <p>O {@code id} é o claim {@code jti} do token. A blacklist é de vida curta: o registro
 * expira automaticamente (TTL via índice) quando o próprio refresh token expira naturalmente
 * (30 dias), então a coleção não cresce indefinidamente.</p>
 */
@Document(collection = "refresh_tokens_revogados")
@TypeAlias("RefreshTokenRevogado")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefreshTokenRevogadoDocument {

    /** {@code jti} (UUID) do refresh token revogado. */
    @Id
    private String id;

    /** E-mail do titular — apenas trilha de auditoria (sem valor sensível). */
    private String email;

    /** Momento em que o token foi revogado (logout ou rotação). */
    private Instant revogadoEm;

    /** Expiração do próprio refresh token; TTL (0s) purga o registro aqui. */
    @Indexed(expireAfter = "0s")
    private Instant expiraEm;
}