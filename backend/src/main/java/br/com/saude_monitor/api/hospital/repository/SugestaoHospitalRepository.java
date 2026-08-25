package br.com.saude_monitor.api.hospital.repository;

import br.com.saude_monitor.api.hospital.document.StatusSugestao;
import br.com.saude_monitor.api.hospital.document.SugestaoHospitalDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Acesso a dados da coleção {@code sugestoes_hospitais} (E1-05 e E1-06).
 */
@Repository
public interface SugestaoHospitalRepository extends MongoRepository<SugestaoHospitalDocument, String> {

    Page<SugestaoHospitalDocument> findByStatusOrderByCriadoEmDesc(StatusSugestao status, Pageable pageable);

    Optional<SugestaoHospitalDocument> findByIdAndStatus(String id, StatusSugestao status);
}
