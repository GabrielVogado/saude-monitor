package br.com.saude_monitor.api.visita.repository;

import br.com.saude_monitor.api.visita.document.StatusVisita;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface VisitaRepository extends MongoRepository<VisitaDocument, String> {

    Optional<VisitaDocument> findFirstByUsuarioIdAndHospitalIdAndStatusInOrderByEntradaDesc(
            String usuarioId, String hospitalId, List<StatusVisita> status);

    Optional<VisitaDocument> findFirstByDispositivoIdAndHospitalIdAndStatusInOrderByEntradaDesc(
            String dispositivoId, String hospitalId, List<StatusVisita> status);

    Optional<VisitaDocument> findFirstByUsuarioIdAndStatusInOrderByEntradaDesc(
            String usuarioId, List<StatusVisita> status);

    Page<VisitaDocument> findByUsuarioIdOrderByEntradaDesc(String usuarioId, Pageable pageable);

    List<VisitaDocument> findByStatusAndUltimoHeartbeatBefore(StatusVisita status, Instant limite);

    List<VisitaDocument> findByStatusInAndUltimoHeartbeatBefore(List<StatusVisita> status, Instant limite);
}
