package br.com.saude_monitor.api.hospital.repository;

import br.com.saude_monitor.api.hospital.document.SugestaoHospitalDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

/**
 * Acesso a dados da coleção {@code sugestoes_hospitais} (E1-05).
 *
 * <p>A revisão/aprovação administrativa (listar pendentes, aprovar, recusar) é
 * fluxo posterior ao Épico 01; aqui apenas o registro público é persistido.</p>
 */
@Repository
public interface SugestaoHospitalRepository extends MongoRepository<SugestaoHospitalDocument, String> {
}
