package br.com.saude_monitor.api.hospital.dto;

/**
 * Filtro de status para a listagem administrativa de hospitais (E7-02 / E7-07).
 *
 * <p>Só faz sentido no caminho admin ({@code GET /api/v1/admin/hospitais}): o contrato
 * público ({@code GET /api/v1/hospitais}) sempre retorna apenas ativos, independentemente
 * deste enum. O padrão do caminho admin é {@link #TODOS}, para atender "listar todos" (E7-02)
 * e permitir marcar os desativados com ícone cinza (E7-07) na mesma tela.</p>
 */
public enum StatusHospital {
    /** Apenas hospitais ativos ({@code ativo=true}). */
    ATIVOS,
    /** Apenas hospitais desativados ({@code ativo=false}). */
    INATIVOS,
    /** Ativos e inativos, sem filtro por {@code ativo}. */
    TODOS
}
