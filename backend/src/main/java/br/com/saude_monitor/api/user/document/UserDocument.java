package br.com.saude_monitor.api.user.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Documento MongoDB da coleção {@code usuarios}.
 *
 * <p>Alinhado à Especificação da API v2.0 (§2.2):</p>
 * <ul>
 *   <li>{@code senhaHash} — senha armazenada somente como hash BCrypt (F0-01), nunca em texto puro;</li>
 *   <li>{@code papel} — papel para autorização (USER | ADMIN);</li>
 *   <li>{@code consentimentos} — base legal LGPD (termos de uso, localização, notificações).</li>
 * </ul>
 */
@Document(collection = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDocument {

	@Id
	private String id;

	private String fullName;

	@Indexed(unique = true)
	private String email;

	private String phone;

	/** Hash BCrypt da senha. Nunca armazenar senha em texto puro. */
	private String senhaHash;

	/** Papel do usuário para autorização (padrão {@code USER}). */
	private Papel papel;

	/** Consentimentos LGPD (termos de uso, localização, notificações). */
	private ConsentimentosDocument consentimentos;

	private boolean active;

	private Instant createdAt;

	private Instant updatedAt;

	/**
	 * Momento da última redefinição de senha via "esqueci minha senha" (nulo se nunca
	 * usada). Refresh tokens emitidos antes deste instante são recusados em
	 * {@code AuthServiceImpl.refresh()} — fecha a sessão de quem tinha um refresh token
	 * válido antes do reset.
	 */
	private Instant senhaAlteradaEm;

	/**
	 * E-mail confirmado via código de 6 dígitos no cadastro (10/09/2026). Sem isso, um
	 * e-mail com erro de digitação ou inexistente nunca recebe o código de "esqueci
	 * minha senha" — a conta fica sem recuperação possível. {@code false} por padrão
	 * (novas contas); contas anteriores a esta feature são migradas para {@code true}
	 * por {@code EmailVerificadoBackfillRunner} — sem isso, todo usuário já cadastrado
	 * ficaria trancado para fora no próximo login.
	 */
	private boolean emailVerificado;
}
