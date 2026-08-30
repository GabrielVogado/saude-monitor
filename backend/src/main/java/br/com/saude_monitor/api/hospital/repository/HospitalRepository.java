package br.com.saude_monitor.api.hospital.repository;

import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Acesso a dados da coleção {@code hospitais}.
 *
 * <p>Listagens (com ou sem filtro geoespacial) são executadas via {@code MongoTemplate}
 * na camada de serviço, pois exigem composição dinâmica de critérios, {@code $near} com
 * distância e paginação — cenários que consultas derivadas não cobrem com elegância.</p>
 */
@Repository
public interface HospitalRepository extends MongoRepository<HospitalDocument, String> {

    /** Nome não é único no índice (UPAs/UBS podem repetir razão social); por isso retorna lista. */
    List<HospitalDocument> findAllByNomeIgnoreCase(String nome);

    /** Hospitais ativos — usado no recálculo em lote dos agregados (Épico 04). */
    List<HospitalDocument> findAllByAtivoTrue();

    boolean existsByCnpj(String cnpj);

    Optional<HospitalDocument> findByCnpj(String cnpj);

    Optional<HospitalDocument> findByCodigoCnes(String codigoCnes);

    /** Busca por chave de deduplicação de importação (registros sem CNES). */
    Optional<HospitalDocument> findByImportKey(String importKey);
}
