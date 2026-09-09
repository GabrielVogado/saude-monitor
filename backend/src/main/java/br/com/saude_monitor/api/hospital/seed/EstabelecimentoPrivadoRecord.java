package br.com.saude_monitor.api.hospital.seed;

/**
 * Um registro do arquivo {@code estabelecimentos_privados.json} — extrato do CNES/DATASUS
 * (hospitais privados/filantrópicos do Distrito Federal, competência 09/2026), lido por
 * {@link EstabelecimentoPrivadoLeitor} e convertido por {@link SeedMapper#montarPrivado}.
 *
 * <p>Os campos chegam BRUTOS (maiúsculas, sem formatação de CEP/CNES) de propósito — a
 * normalização é feita uma única vez, em {@link EstabelecimentoNormalizador}, a mesma
 * usada pelo pipeline DBF/SHP da rede pública.</p>
 *
 * @param nome        nome fantasia (ou razão social) do estabelecimento
 * @param tipo        {@code "PRIVADO"} ou {@code "FILANTROPICO"} (nunca {@code "PUBLICO"} —
 *                    ver {@link SeedMapper#montarPrivado})
 * @param codigoCnes  código CNES bruto (obrigatório — sem CNES o registro é descartado)
 * @param logradouro  logradouro bruto (pode ser {@code null})
 * @param numero      número do endereço (pode ser {@code null} ou {@code "S/N"})
 * @param bairro      bairro bruto (pode ser {@code null})
 * @param cep         CEP bruto (pode ser {@code null})
 * @param latitude    latitude em graus decimais (CNES já publica coordenada própria)
 * @param longitude   longitude em graus decimais
 */
public record EstabelecimentoPrivadoRecord(
        String nome,
        String tipo,
        String codigoCnes,
        String logradouro,
        String numero,
        String bairro,
        String cep,
        Double latitude,
        Double longitude
) {
}
