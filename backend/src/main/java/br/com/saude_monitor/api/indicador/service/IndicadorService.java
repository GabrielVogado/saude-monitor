package br.com.saude_monitor.api.indicador.service;

import br.com.saude_monitor.api.indicador.dto.IndicadoresDetalheResponse;
import br.com.saude_monitor.api.indicador.document.IndicadorHospitalDocument;
import br.com.saude_monitor.api.hospital.dto.IndicadoresResponse;

import java.util.Collection;
import java.util.List;

/**
 * Contrato do serviço de agregação de indicadores públicos (Épico 04 / F-06).
 *
 * <p>Responsabilidades: calcular e persistir os indicadores por hospital (RN-14..RN-17),
 * expor os indicadores na forma embutida da listagem/detalhe (compacta) e na forma
 * enriquecida do endpoint dedicado (§3.5), e suportar o recálculo por evento e por
 * job (RN-18).</p>
 */
public interface IndicadorService {

    /**
     * Recalcula e persiste (upsert) o indicador de um único hospital (RN-18 — evento
     * disparado após novo feedback, e job de 15min).
     */
    IndicadorHospitalDocument recalcular(String hospitalId);

    /**
     * Indicadores embutidos (compactos) para a listagem/detalhe público de hospitais —
     * conjunto de ids em lote para evitar N+1. Sempre retorna um valor por id.
     */
    List<IndicadoresResponse> mapaIndicadores(Collection<String> hospitalIds);

    /**
     * Indicadores enriquecidos do endpoint dedicado {@code GET /hospitais/{id}/indicadores}
     * (§3.5), com {@code nVisitas}, {@code periodo} e {@code atualizadoEm}.
     */
    IndicadoresDetalheResponse obterDetalhe(String hospitalId);

    /**
     * Recalcula indicadores pendentes em lote (job de 15min, RN-18/@Scheduled):
     * processa hospitais sem indicador (ainda não calculado) e os com feedback novo.
     */
    void recalcularPendentes();
}
