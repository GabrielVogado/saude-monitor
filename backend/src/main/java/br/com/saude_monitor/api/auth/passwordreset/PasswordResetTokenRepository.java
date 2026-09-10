package br.com.saude_monitor.api.auth.passwordreset;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/** Acesso ao código de redefinição de senha ativo por e-mail. */
@Repository
public interface PasswordResetTokenRepository
        extends MongoRepository<PasswordResetTokenDocument, String> {

    Optional<PasswordResetTokenDocument> findByEmail(String email);

    void deleteByEmail(String email);
}
