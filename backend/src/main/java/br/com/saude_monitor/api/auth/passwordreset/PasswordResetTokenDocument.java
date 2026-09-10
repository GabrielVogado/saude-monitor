package br.com.saude_monitor.api.auth.passwordreset;

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
 * Código de redefinição de senha (coleção {@code password_reset_tokens}), no mesmo padrão
 * de TTL de {@link br.com.saude_monitor.api.auth.revogacao.RefreshTokenRevogadoDocument}.
 *
 * <p>{@code email} é único e indexado: pedir um novo código faz upsert sobre o registro
 * existente, então nunca há mais de um código ativo por e-mail — evita acúmulo de tokens
 * e múltiplos e-mails de código na mesma caixa de entrada.</p>
 */
@Document(collection = "password_reset_tokens")
@TypeAlias("PasswordResetToken")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PasswordResetTokenDocument {

    @Id
    private String id;

    /** E-mail normalizado do titular; único — upsert em vez de insert a cada pedido. */
    @Indexed(unique = true)
    private String email;

    /** Hash BCrypt do código de 6 dígitos (mesmo {@code PasswordEncoder} do {@code senhaHash}). */
    private String codigoHash;

    /** Tentativas de verificação já consumidas; estourou o limite, o token é descartado. */
    @Builder.Default
    private int tentativas = 0;

    private Instant criadoEm;

    /** TTL (0s): o registro expira sozinho quando o código vence (15 min). */
    @Indexed(expireAfter = "0s")
    private Instant expiraEm;
}
