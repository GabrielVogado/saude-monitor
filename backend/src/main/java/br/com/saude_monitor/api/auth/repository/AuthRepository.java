package br.com.saude_monitor.api.auth.repository;

import br.com.saude_monitor.api.auth.document.AuthDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AuthRepository extends MongoRepository<AuthDocument, String> {

	Optional<AuthDocument> findByUser_Id(String userId);

	Optional<AuthDocument> findByEmail(String email);

	boolean existsByUser_Id(String userId);
}
