package br.com.saude_monitor.api.feedback.repository;

import br.com.saude_monitor.api.feedback.document.FeedbackDocument;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface FeedbackRepository extends MongoRepository<FeedbackDocument, String> {

    boolean existsByVisitaId(String visitaId);

    Optional<FeedbackDocument> findByVisitaId(String visitaId);

    /**
     * Feedbacks de um hospital criados após {@code criadoEm} e com nota preenchida —
     * usada na agregação de indicadores (Épico 04, RN-14).
     */
    List<FeedbackDocument> findByHospitalIdAndCriadoEmAfterAndNotaNotNull(String hospitalId, Instant criadoEm);
}
