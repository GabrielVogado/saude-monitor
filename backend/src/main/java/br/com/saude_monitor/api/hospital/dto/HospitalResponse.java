package br.com.saude_monitor.api.hospital.dto;

import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;

import java.time.Instant;

/**
 * Resposta completa do hospital (detalhe público e respostas de escrita admin).
 */
public record HospitalResponse(
        String id,
        String nome,
        String cnpj,
        TipoEstabelecimento tipo,
        CategoriaEstabelecimento categoria,
        String horarioFuncionamento,
        Boolean salaVacina,
        Boolean farmacia,
        Boolean coletaMaterial,
        String tipoUnidade,
        EnderecoDto endereco,
        ContatoDto contato,
        GeoJsonPolygonDto geofence,
        boolean ativo,
        IndicadoresResponse indicadores,
        Instant criadoEm,
        Instant atualizadoEm
) {
}
