package br.com.saude_monitor.api.user.repository;

import br.com.saude_monitor.api.user.document.UserDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends MongoRepository<UserDocument, String> {

	Optional<UserDocument> findByEmail(String email);
}

