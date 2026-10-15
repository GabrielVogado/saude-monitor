package br.com.saude_monitor.api.regiao.service;

import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Resolução de Região Administrativa por point-in-polygon (E7-03), contra o GeoJSON real
 * de {@code regiao-administrativa} (mesma camada servida em {@code /api/v1/camadas}).
 */
class RegiaoAdministrativaResolverTest {

    /**
     * Mesma coordenada de {@code IntegracaoTestBase.LAT/LON}, confirmada por
     * point-in-polygon independente (script Node) como dentro do polígono de
     * "Recanto das Emas" — não é um valor arbitrário.
     */
    private static final double LON_RECANTO_DAS_EMAS = -48.0742;
    private static final double LAT_RECANTO_DAS_EMAS = -15.9023;

    private RegiaoAdministrativaResolver resolverCarregado() {
        RegiaoService regiaoService = new RegiaoService();
        regiaoService.carregar();
        RegiaoAdministrativaResolver resolver = new RegiaoAdministrativaResolver(regiaoService);
        resolver.carregar();
        return resolver;
    }

    @Test
    void resolveARegiaoQueContemOPonto() {
        RegiaoAdministrativaResolver resolver = resolverCarregado();

        Optional<String> regiao = resolver.resolver(LON_RECANTO_DAS_EMAS, LAT_RECANTO_DAS_EMAS);

        assertThat(regiao).contains("Recanto das Emas");
    }

    @Test
    void devolveVazioParaPontoForaDeTodaRegiaoMapeada() {
        RegiaoAdministrativaResolver resolver = resolverCarregado();

        // Ponto no meio do Oceano Atlântico — fora do Distrito Federal e de qualquer RA.
        Optional<String> regiao = resolver.resolver(0.0, 0.0);

        assertThat(regiao).isEmpty();
    }

    @Test
    void listaAs35RegioesDisponiveisOrdenadasPorNome() {
        RegiaoAdministrativaResolver resolver = resolverCarregado();

        var nomes = resolver.nomesDisponiveis();

        assertThat(nomes).hasSize(35);
        assertThat(nomes).contains("Plano Piloto", "Recanto das Emas", "Ceilândia");
        assertThat(nomes).isSorted();
    }
}
