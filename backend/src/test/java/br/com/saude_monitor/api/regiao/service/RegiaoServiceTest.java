package br.com.saude_monitor.api.regiao.service;

import br.com.saude_monitor.api.config.exception.RecursoNaoEncontradoException;
import br.com.saude_monitor.api.regiao.TipoCamada;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Serviço de camadas geográficas (F-11, §5) — sem MongoDB: os GeoJSON vivem no
 * classpath e são carregados uma vez.
 */
class RegiaoServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private RegiaoService servicoCarregado() {
        RegiaoService servico = new RegiaoService();
        servico.carregar();
        return servico;
    }

    @Test
    void deveCarregarAsQuatroCamadasNaSubida() {
        RegiaoService servico = servicoCarregado();

        assertThat(servico.camadasParaTeste()).containsKeys(TipoCamada.values());
        for (TipoCamada tipo : TipoCamada.values()) {
            assertThat(servico.buscar(tipo)).isNotBlank();
        }
    }

    @Test
    void deveServirFeatureCollectionsComAsContagensConvertidas() throws Exception {
        RegiaoService servico = servicoCarregado();

        assertThat(contarFeatures(servico, TipoCamada.REGIAO_ADMINISTRATIVA)).isEqualTo(35);
        assertThat(contarFeatures(servico, TipoCamada.RIDE)).isEqualTo(33);
        assertThat(contarFeatures(servico, TipoCamada.REGIAO_SAUDE)).isEqualTo(7);
        assertThat(contarFeatures(servico, TipoCamada.MACRORREGIAO_SAUDE)).isEqualTo(3);
    }

    @Test
    void deveExporApenasOsAtributosDoContrato() throws Exception {
        RegiaoService servico = servicoCarregado();

        JsonNode primeira = mapper.readTree(servico.buscar(TipoCamada.REGIAO_ADMINISTRATIVA))
                .get("features").get(0).get("properties");
        assertThat(primeira.fieldNames())
                .toIterable()
                .containsExactlyInAnyOrder("nome", "regiaoSaude", "macrorregiaoSaude");
    }

    @Test
    void deveRejeitarSlugDesconhecidoCom404DoEnvelopePadrao() {
        assertThatThrownBy(() -> TipoCamada.fromSlug("bairros"))
                .isInstanceOf(RecursoNaoEncontradoException.class)
                .hasMessageContaining("bairros");
    }

    private int contarFeatures(RegiaoService servico, TipoCamada tipo) throws Exception {
        return mapper.readTree(servico.buscar(tipo)).get("features").size();
    }
}
