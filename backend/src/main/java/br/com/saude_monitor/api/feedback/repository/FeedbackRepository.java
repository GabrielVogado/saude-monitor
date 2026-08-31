package br.com.saude_monitor.api.feedback.repository;

import br.com.saude_monitor.api.feedback.document.FeedbackDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface FeedbackRepository extends MongoRepository<FeedbackDocument, String> {

    boolean existsByVisitaId(String visitaId);

    Optional<FeedbackDocument> findByVisitaId(String visitaId);

    /** Histórico de feedbacks do usuário (E5-03/RN-22), do mais recente ao mais antigo. */
    Page<FeedbackDocument> findByUsuarioIdOrderByCriadoEmDesc(String usuarioId, Pageable pageable);

    /**
     * Feedbacks de um hospital criados após {@code criadoEm} e com nota preenchida —
     * usada na agregação de indicadores (Épico 04, RN-14).
     */
    List<FeedbackDocument> findByHospitalIdAndCriadoEmAfterAndNotaNotNull(String hospitalId, Instant criadoEm);
}
