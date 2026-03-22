package br.com.saude_monitor.api.auth.repository;

import br.com.saude_monitor.api.auth.document.AuthDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AuthRepository extends MongoRepository<AuthDocument, String> {
}
