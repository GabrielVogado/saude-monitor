package br.com.saude_monitor.api.auth.document;

import br.com.saude_monitor.api.user.document.UserDocument;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DocumentReference;

import java.time.Instant;

/**
 * Registro de autenticação (coleção {@code auth_logins}) — trilha de auditoria de login.
 *
 * <p><strong>Segurança (F0-01):</strong> este documento NÃO armazena senha. A senha vive
 * apenas como hash BCrypt em {@link UserDocument#senhaHash}. Tokens JWT também nunca são
 * persistidos (apenas no cliente).</p>
 */
@Document(collection = "auth_logins")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthDocument {

	@Id
	private String id;

	@Indexed(unique = true, sparse = true)
	@DocumentReference(lazy = true)
	private UserDocument user;

	@Indexed(unique = true)
	private String email;

	private boolean rememberDevice;

	private Instant createdAt;
}
