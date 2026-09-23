package br.com.saude_monitor.api.hospital.migration;

/**
 * Registro bruto de um estabelecimento de saúde lido da fonte de importação
 * (CSV/JSON no padrão CNES do SUS).
 *
 * <p>Campos normalizados para a importação de Hospitais, UPAs e UBS de Brasília-DF.
 * A modelagem final do esquema (responsabilidade do agente Rafael) pode redefinir os
 * nomes de colunas; este record centraliza o contrato de entrada para facilitar o ajuste.</p>
 */
public record EstabelecimentoSaudeRaw(
        String codigoCnes,
        String cnpj,
        String razaoSocial,
        String nomeFantasia,
        String logradouro,
        String numero,
        String complemento,
        String bairro,
        String municipio,
        String uf,
        String cep,
        String telefone,
        String email,
        String tipoUnidade,
        String descricaoTipoUnidade,
        Double latitude,
        Double longitude
) {
}
