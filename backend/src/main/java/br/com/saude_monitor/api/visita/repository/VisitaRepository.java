package br.com.saude_monitor.api.visita.repository;

import br.com.saude_monitor.api.visita.document.StatusVisita;
import br.com.saude_monitor.api.visita.document.TipoPermanencia;
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

    List<VisitaDocument> findByStatus(StatusVisita status);

    /** Visitas finalizadas cuja saída ocorreu antes de {@code limite} — usada pelo job de feedback sem resposta (RN-09). */
    List<VisitaDocument> findByStatusAndSaidaBefore(StatusVisita status, Instant limite);

    /**
     * Visitas de um hospital, de um conjunto de status, com saída no intervalo
     * {@code [inicio, fim]} e permanência do tipo dado — usada na agregação do indicador
     * de tempo (Épico 04, RN-16/RN-24). Inclui {@code GPS_INTERROMPIDO} para o tratamento
     * de cobertura de GPS (RN-17) feito na camada de serviço.
     */
    List<VisitaDocument> findByHospitalIdAndStatusInAndSaidaBetweenAndTipoPermanencia(
            String hospitalId, List<StatusVisita> status, Instant inicio, Instant fim, TipoPermanencia tipoPermanencia);
}
