package br.com.saude_monitor.api.auth.document;

import br.com.saude_monitor.api.auth.dto.LoginRequest;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

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
	private String email;
	private String password;
	private boolean rememberDevice;
	private Instant createdAt;

}
