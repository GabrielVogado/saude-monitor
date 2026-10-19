package br.com.saude_monitor.api.hospital.dto;

import java.util.List;

/**
 * Catálogo público de estabelecimentos (ARQ-01), servido por {@code GET /api/v1/catalogo}.
 *
 * <p>É o mesmo conteúdo para qualquer pessoa, por isso pode ser guardado pelo app e pela borda.
 * {@code versao} é o resumo do conteúdo e vai também no {@code ETag}: muda quando algum
 * estabelecimento ou indicador muda, e só nesse caso.</p>
 */
public record CatalogoResponse(
        String versao,
        int total,
        List<HospitalResumoResponse> estabelecimentos
) {
}
