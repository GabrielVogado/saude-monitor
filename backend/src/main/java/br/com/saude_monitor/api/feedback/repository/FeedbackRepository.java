package br.com.saude_monitor.api.feedback.repository;

import br.com.saude_monitor.api.feedback.document.FeedbackDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.Collection;
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

    /**
     * Feedbacks criados após {@code criadoEm}, de qualquer hospital — usado por
     * {@code recalcularPendentes} para descobrir quais hospitais tiveram atividade
     * recente sem precisar recalcular os ~340 hospitais ativos a cada execução.
     */
    List<FeedbackDocument> findByCriadoEmAfter(Instant criadoEm);

    /**
     * Feedbacks das visitas informadas, em lote — evita N+1 de
     * {@code existsByVisitaId} chamado dentro de um loop.
     */
    List<FeedbackDocument> findByVisitaIdIn(Collection<String> visitaIds);
}
