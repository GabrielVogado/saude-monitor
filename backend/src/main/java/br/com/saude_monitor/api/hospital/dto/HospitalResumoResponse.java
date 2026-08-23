package br.com.saude_monitor.api.hospital.dto;

import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;

/**
 * Resumo do hospital exposto na listagem pública {@code GET /api/v1/hospitais}.
 *
 * <p>Intencionalmente NÃO inclui {@code cnpj} nem {@code contato}: a listagem pública
 * não deve vazar dados administrativos (alinhado à postura LGPD do produto — F-09).</p>
 */
public record HospitalResumoResponse(
        String id,
        String nome,
        TipoEstabelecimento tipo,
        CategoriaEstabelecimento categoria,
        String tipoUnidade,
        EnderecoDto endereco,
        GeoJsonPolygonDto geofence,
        boolean ativo,
        IndicadoresResponse indicadores
) {
}
