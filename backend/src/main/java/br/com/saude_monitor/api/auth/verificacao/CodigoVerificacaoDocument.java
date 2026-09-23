package br.com.saude_monitor.api.auth.verificacao;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.TypeAlias;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Código de verificação de 6 dígitos (coleção {@code codigos_verificacao}), no mesmo
 * padrão de TTL de {@link br.com.saude_monitor.api.auth.revogacao.RefreshTokenRevogadoDocument}.
 *
 * <p>Generalizado em 10/09/2026 (era {@code PasswordResetTokenDocument}, só para
 * "esqueci minha senha") para também cobrir a confirmação de e-mail no cadastro — as
 * duas correções de concorrência já feitas ali (upsert atômico contra
 * {@code DuplicateKeyException}, incremento atômico de tentativas) valem para os dois
 * fluxos sem duplicar código.</p>
 *
 * <p>Chave única é o par {@code (email, proposito)}: um titular pode ter um código de
 * redefinição de senha e um de confirmação de e-mail pendentes ao mesmo tempo, sem
 * colidir. Pedir um novo código do mesmo propósito faz upsert sobre o registro
 * existente — nunca há dois códigos ativos do mesmo tipo para o mesmo e-mail.</p>
 */
@Document(collection = "codigos_verificacao")
@TypeAlias("CodigoVerificacao")
@CompoundIndex(def = "{'email': 1, 'proposito': 1}", unique = true)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CodigoVerificacaoDocument {

    @Id
    private String id;

    /** E-mail normalizado do titular. */
    private String email;

    /** Para que serve este código — ver {@link Proposito}. */
    private Proposito proposito;

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
