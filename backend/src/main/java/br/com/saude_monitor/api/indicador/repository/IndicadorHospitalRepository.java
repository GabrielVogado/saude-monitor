package br.com.saude_monitor.api.indicador.repository;

import br.com.saude_monitor.api.indicador.document.IndicadorHospitalDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Acesso a dados da coleção {@code agregados_hospitais} (Épico 04).
 *
 * <p>Opera de forma "leve" na consulta pública (leitura de um indicador por hospital),
 * enquanto a escrita (upsert) em lote é feita via {@code MongoTemplate} na camada de
 * serviço para permitir {@code $set} idempotente por {@code hospitalId}.</p>
 */
@Repository
public interface IndicadorHospitalRepository extends MongoRepository<IndicadorHospitalDocument, String> {

    Optional<IndicadorHospitalDocument> findByHospitalId(String hospitalId);

    List<IndicadorHospitalDocument> findByHospitalIdIn(Collection<String> hospitalIds);

    /** Indicadores atualizados após {@code atualizadoEm} — usado pelo job para detectar hospitais com feedback novo. */
    List<IndicadorHospitalDocument> findByIdInAndAtualizadoEmAfter(Collection<String> ids, Instant atualizadoEm);
}
