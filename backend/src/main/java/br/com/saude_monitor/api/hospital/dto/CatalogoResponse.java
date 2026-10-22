package br.com.saude_monitor.api.hospital.dto;

import java.util.List;

/**
 * Catálogo público de estabelecimentos (ARQ-01), servido por {@code GET /api/v1/catalogo}.
 *
 * <p>É o mesmo conteúdo para qualquer pessoa, por isso pode ser guardado pelo app e pela borda.
 * Os itens vêm sem indicadores ({@code indicadores = null}); nota e tempo ficam em
 * {@code GET /api/v1/catalogo/indicadores}. {@code versao} é o resumo do conteúdo e vai também
 * no {@code ETag} e no {@code versaoCatalogo} da configuração remota: muda quando algum
 * estabelecimento muda pelo painel (ou pela carga de dados), e só nesse caso.</p>
 */
public record CatalogoResponse(
        String versao,
        int total,
        List<HospitalResumoResponse> estabelecimentos
) {
}
