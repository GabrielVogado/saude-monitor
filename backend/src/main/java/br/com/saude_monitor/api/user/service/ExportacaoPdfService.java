package br.com.saude_monitor.api.user.service;

import java.util.Map;

/**
 * Geração do relatório PDF de exportação de dados do titular (E5-03 / art. 18 LGPD).
 *
 * <p>Recebe o mesmo agregado devolvido por {@link UserService#exportarDados(String)} e
 * o transforma num documento legível pelo cidadão — o formato JSON continua disponível
 * em {@code GET /api/v1/contas/export} para uso técnico/portabilidade automatizada.</p>
 */
public interface ExportacaoPdfService {

    /**
     * Renderiza o relatório de dados pessoais em PDF.
     *
     * @param dados agregado com {@code geradoEm}, {@code usuario}, {@code visitas} e
     *              {@code feedbacks} (formato de {@link UserService#exportarDados(String)})
     * @return bytes do PDF gerado
     */
    byte[] gerar(Map<String, Object> dados);
}
