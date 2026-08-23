package br.com.saude_monitor.api.hospital.service;

import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import br.com.saude_monitor.api.hospital.dto.GeoJsonPolygonDto;
import br.com.saude_monitor.api.hospital.dto.HospitalRequest;
import br.com.saude_monitor.api.hospital.dto.HospitalResumoResponse;
import br.com.saude_monitor.api.hospital.dto.HospitalResponse;
import br.com.saude_monitor.api.hospital.dto.PageResponse;
import br.com.saude_monitor.api.hospital.dto.SugestaoHospitalRequest;
import br.com.saude_monitor.api.hospital.dto.SugestaoHospitalResponse;

/**
 * Contrato do serviço de hospitais (Épico 01).
 */
public interface HospitalService {

    HospitalResponse criar(HospitalRequest request);

    HospitalResponse atualizar(String id, HospitalRequest request);

    HospitalResponse buscarPorId(String id);

    GeoJsonPolygonDto buscarGeofence(String id);

    PageResponse<HospitalResumoResponse> listar(Double latitude, Double longitude, Double raioKm,
                                                TipoEstabelecimento tipo, String busca, int page, int size);

    HospitalResponse alterarStatus(String id, boolean ativo);

    /** Registra uma sugestão pública de hospital ainda não cadastrado (E1-05). */
    SugestaoHospitalResponse sugerir(SugestaoHospitalRequest request);
}
