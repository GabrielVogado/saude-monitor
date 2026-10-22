package br.com.saude_monitor.api.hospital.dto;

import java.util.Map;

/**
 * Indicadores de todos os estabelecimentos do catálogo, servidos por
 * {@code GET /api/v1/catalogo/indicadores}.
 *
 * <p>Ficam fora do catálogo porque mudam a cada avaliação, enquanto o catálogo só muda pelo
 * painel. Assim o app guarda o catálogo e o baixa de novo só quando a versão dele muda, e
 * busca nota e tempo numa resposta leve, a mesma para qualquer pessoa.
 * {@code versao} é o resumo do conteúdo e vai também no {@code ETag}.</p>
 *
 * @param versao       resumo do conteúdo
 * @param porHospital  indicadores por id do hospital, na ordem do catálogo
 */
public record IndicadoresCatalogoResponse(
        String versao,
        Map<String, IndicadoresResponse> porHospital
) {
}
