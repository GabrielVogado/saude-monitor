package br.com.saude_monitor.api.hospital.seed;

/**
 * Um registro do arquivo {@code hospitais_publicos_complementares.json} — hospitais
 * PÚBLICOS presentes no CNES/DATASUS que não aparecem na fonte InfoSaúde/GDF (DBF/SHP)
 * usada pelo pipeline principal do seed. Lido por {@link HospitalPublicoComplementarLeitor}
 * e convertido por {@link SeedMapper#montarPublicoComplementar}.
 *
 * <p>Fonte exclusiva de hospitais PÚBLICOS — hospitais privados/filantrópicos ficam fora
 * de escopo por decisão do PO (08/09/2026): ver
 * {@code Documentos/07-dados/relatorio-importacao-CNES_PUBLICOS_COMPLEMENTARES_20260909.md}.
 * Por isso este registro não tem campo {@code tipo}: todo registro lido daqui é
 * PÚBLICO, sempre — não há ambiguidade de classificação a carregar.</p>
 *
 * <p>Os campos chegam BRUTOS (maiúsculas, sem formatação de CEP/CNES) de propósito — a
 * normalização é feita uma única vez, em {@link EstabelecimentoNormalizador}, a mesma
 * usada pelo pipeline DBF/SHP da rede pública.</p>
 *
 * @param nome        nome fantasia (ou razão social) do estabelecimento
 * @param codigoCnes  código CNES bruto (obrigatório — sem CNES o registro é descartado)
 * @param logradouro  logradouro bruto (pode ser {@code null})
 * @param numero      número do endereço (pode ser {@code null} ou {@code "S/N"})
 * @param bairro      bairro bruto (pode ser {@code null})
 * @param cep         CEP bruto (pode ser {@code null})
 * @param latitude    latitude em graus decimais (CNES já publica coordenada própria)
 * @param longitude   longitude em graus decimais
 */
public record HospitalPublicoComplementarRecord(
        String nome,
        String codigoCnes,
        String logradouro,
        String numero,
        String bairro,
        String cep,
        Double latitude,
        Double longitude
) {
}
