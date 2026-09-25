package br.com.saude_monitor.api.hospital.dto;

import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;

import java.time.Instant;

/**
 * Resposta completa do hospital (detalhe público e respostas de escrita admin).
 *
 * <p>{@code regiaoAdministrativa} (E7-03/E7-05, Painel Admin) é derivado das coordenadas
 * por point-in-polygon, não um campo do cadastro — pode ser {@code null} (ver
 * {@code HospitalDocument#regiaoAdministrativa}). Adicionado aqui em paridade com
 * {@link HospitalResumoResponse}, para a tela de detalhe do painel não depender de
 * carregar o campo por fora (ex. estado de navegação, frágil em reload direto da URL).</p>
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
        String regiaoAdministrativa,
        IndicadoresResponse indicadores,
        Instant criadoEm,
        Instant atualizadoEm
) {
}
