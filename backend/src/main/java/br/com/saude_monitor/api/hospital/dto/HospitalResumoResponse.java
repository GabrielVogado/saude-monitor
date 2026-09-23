package br.com.saude_monitor.api.hospital.dto;

import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;

/**
 * Resumo do hospital exposto na listagem pública {@code GET /api/v1/hospitais}.
 *
 * <p>Intencionalmente NÃO inclui {@code cnpj} nem {@code contato}: a listagem pública
 * não deve vazar dados administrativos (alinhado à postura LGPD do produto — F-09).</p>
 *
 * <p>Também NÃO inclui o polígono do geofence (E8-03). Medido em 02/09/2026, o campo
 * {@code geofence} respondia por 73,6% do corpo da resposta (27.849 de 37.838 bytes em
 * uma página de 20 itens), com 33 vértices por hospital e 15 casas decimais por
 * coordenada. Como o polígono é um círculo derivado, {@code localizacao} (centroide já
 * persistido e indexado) e {@code raioMetros} bastam para o cliente reconstruí-lo. O
 * polígono completo continua disponível em {@code GET /api/v1/hospitais/{id}} e em
 * {@code GET /api/v1/hospitais/{id}/geofence}.</p>
 */
public record HospitalResumoResponse(
        String id,
        String nome,
        TipoEstabelecimento tipo,
        CategoriaEstabelecimento categoria,
        String tipoUnidade,
        EnderecoDto endereco,
        LocalizacaoDto localizacao,
        Integer raioMetros,
        boolean ativo,
        IndicadoresResponse indicadores
) {
}
