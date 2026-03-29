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
	private String password;
	private boolean rememberDevice;
	private Instant createdAt;

}
