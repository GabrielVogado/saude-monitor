package br.com.saude_monitor.api.feedback.repository;

import br.com.saude_monitor.api.feedback.document.FeedbackDocument;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface FeedbackRepository extends MongoRepository<FeedbackDocument, String> {

    boolean existsByVisitaId(String visitaId);

    Optional<FeedbackDocument> findByVisitaId(String visitaId);
}
