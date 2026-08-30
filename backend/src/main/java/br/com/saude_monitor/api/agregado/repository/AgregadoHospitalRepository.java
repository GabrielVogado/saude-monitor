package br.com.saude_monitor.api.agregado.repository;

import br.com.saude_monitor.api.agregado.document.AgregadoHospitalDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Acesso a dados da coleção {@code agregados_hospitais} (Épico 04).
 *
 * <p>Opera de forma "leve" na consulta pública (leitura de um agregado por hospital),
 * enquanto a escrita (upsert) em lote é feita via {@code MongoTemplate} na camada de
 * serviço para permitir {@code $set} idempotente por {@code hospitalId}.</p>
 */
@Repository
public interface AgregadoHospitalRepository extends MongoRepository<AgregadoHospitalDocument, String> {

    Optional<AgregadoHospitalDocument> findByHospitalId(String hospitalId);

    List<AgregadoHospitalDocument> findByHospitalIdIn(Collection<String> hospitalIds);

    /** Agregados atualizados após {@code atualizadoEm} — usado pelo job para detectar hospitais com feedback novo. */
    List<AgregadoHospitalDocument> findByIdInAndAtualizadoEmAfter(Collection<String> ids, Instant atualizadoEm);
}
