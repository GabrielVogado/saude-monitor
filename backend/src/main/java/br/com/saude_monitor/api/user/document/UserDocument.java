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

	private boolean active;

	private Instant createdAt;

	private Instant updatedAt;
}
