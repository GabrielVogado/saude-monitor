package br.com.saude_monitor.api.hospital.migration;

import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Classifica um estabelecimento importado (CNES) em {@link CategoriaEstabelecimento}
 * e {@link TipoEstabelecimento}.
 *
 * <p>Prioriza palavras-chave na descrição do tipo de unidade, que são mais confiáveis
 * que o código numérico para distinguir Hospital, UPA e UBS.</p>
 */
@Component
public class CategoriaMapper {

    /**
     * Infere a categoria assistencial a partir do código/descrição do tipo de unidade.
     * Ordem das regras importa: "pronto atendimento" (UPA) precede "hospital/pronto socorro".
     */
    public CategoriaEstabelecimento categorizar(String tipoUnidade, String descricaoTipoUnidade) {
        String alvo = normalizar(tipoUnidade + " " + descricaoTipoUnidade);

        if (alvo.contains("upa") || alvo.contains("pronto atendimento")) {
            return CategoriaEstabelecimento.UPA;
        }
        if (alvo.contains("hospital") || alvo.contains("pronto socorro")
                || alvo.contains("pronto-socorro")) {
            return CategoriaEstabelecimento.HOSPITAL;
        }
        if (alvo.contains("ubs") || alvo.contains("unidade basica")
                || alvo.contains("unidade básica") || alvo.contains("centro de saude")
                || alvo.contains("centro saúde") || alvo.contains("posto de saude")) {
            return CategoriaEstabelecimento.UBS;
        }
        return CategoriaEstabelecimento.OUTRO;
    }

    /**
     * Os dados de Brasília-DF (SUS) são majoritariamente públicos. Mantém {@code PUBLICO}
     * como padrão; refinamentos para estabelecimentos privados podem ser feitos quando a
     * fonte incluir o campo de natureza administrativa.
     */
    public TipoEstabelecimento tipificar(EstabelecimentoSaudeRaw registro) {
        return TipoEstabelecimento.PUBLICO;
    }

    private String normalizar(String valor) {
        if (valor == null) {
            return "";
        }
        return java.text.Normalizer.normalize(valor, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
    }
}
