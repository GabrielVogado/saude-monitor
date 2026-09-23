package br.com.saude_monitor.api.hospital.service.impl;

import br.com.saude_monitor.api.agregado.service.AgregadoService;
import br.com.saude_monitor.api.config.security.AutenticacaoHelper;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import br.com.saude_monitor.api.hospital.dto.IndicadoresResponse;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.hospital.repository.SugestaoHospitalRepository;
import br.com.saude_monitor.api.hospital.service.GeofenceFactory;
import br.com.saude_monitor.api.hospital.service.GeofenceValidator;
import br.com.saude_monitor.api.hospital.service.HospitalService;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Listagem sem filtro geoespacial (aba "Hospitais" e mapa com o chip "Todos") — a
 * consulta que o serviço monta quando {@code latitude}/{@code longitude} não são
 * informados.
 *
 * <p>Regressão coberta: sem um {@code Sort} explícito, {@code buscarPaginado} pagina
 * em memória ({@code subList}) sobre a ordem "natural" do MongoDB, que não é garantida
 * entre chamadas. Como o controller limita {@code size} a 100 e a base tem ~340
 * hospitais ativos, a única forma de um cliente ver o catálogo inteiro sem esse cap é
 * percorrer página a página até completar o total — e sem ordenação estável, isso pode
 * pular ou repetir hospitais entre uma chamada e a próxima (foi como a UBS 05 do
 * Recanto das Emas ficou de fora do mapa com o filtro "Todos", relatado em 09/09/2026).</p>
 */
class ListagemSemFiltroGeoTest {

    private final HospitalRepository hospitalRepository = mock(HospitalRepository.class);
    private final SugestaoHospitalRepository sugestaoRepository = mock(SugestaoHospitalRepository.class);
    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final GeofenceValidator geofenceValidator = mock(GeofenceValidator.class);
    private final GeofenceFactory geofenceFactory = mock(GeofenceFactory.class);
    private final AutenticacaoHelper autenticacaoHelper = mock(AutenticacaoHelper.class);
    private final AgregadoService agregadoService = mock(AgregadoService.class);

    private final HospitalService service =
            new HospitalServiceImpl(hospitalRepository, sugestaoRepository, mongoTemplate,
                    geofenceValidator, geofenceFactory, autenticacaoHelper, agregadoService);

    @BeforeEach
    void setup() {
        when(mongoTemplate.find(any(Query.class), eq(HospitalDocument.class)))
                .thenReturn(List.of(
                        hospital("h1", "Ubs 10 Recanto das Emas"),
                        hospital("h2", "Ubs 05 Recanto das Emas"),
                        hospital("h3", "Hospital Regional do Gama")));
        when(agregadoService.mapaIndicadores(anyCollection()))
                .thenAnswer(inv -> ((java.util.Collection<?>) inv.getArgument(0)).stream()
                        .map(id -> IndicadoresResponse.indisponivel())
                        .toList());
    }

    private HospitalDocument hospital(String id, String nome) {
        return HospitalDocument.builder().id(id).nome(nome).tipo(TipoEstabelecimento.PUBLICO).ativo(true).build();
    }

    @Test
    @DisplayName("a consulta sem coordenada ordena por nome, para paginação em memória estável")
    void ordenaPorNomeDeFormaEstavel() {
        service.listar(null, null, null, null, null, 0, 20);

        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        org.mockito.Mockito.verify(mongoTemplate).find(captor.capture(), eq(HospitalDocument.class));
        Document sort = captor.getValue().getSortObject();

        assertThat(sort.get("nome")).as("sem isso, duas chamadas sucessivas de página podem "
                + "divergir na ordem 'natural' do Mongo e pular/repetir hospitais").isEqualTo(1);
    }

    @Test
    @DisplayName("o id entra como critério de desempate — nome sozinho não é ordem total")
    void desempataPorIdQuandoNomesEmpatam() {
        // O ImportadorEstabelecimentos (migração CNES) grava direto via
        // `hospitalRepository.save`, sem passar por `validarUnicidade` — dois
        // estabelecimentos importados podem legitimamente compartilhar o mesmo nome. Só
        // `Sort.by("nome")` não garante ordem relativa consistente entre chamadas para
        // esse par, então a paginação por página ainda poderia pular ou repetir um deles.
        service.listar(null, null, null, null, null, 0, 20);

        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        org.mockito.Mockito.verify(mongoTemplate).find(captor.capture(), eq(HospitalDocument.class));
        Document sort = captor.getValue().getSortObject();

        assertThat(sort.get("id")).isEqualTo(1);
    }
}
