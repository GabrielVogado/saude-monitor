package br.com.saude_monitor.api.hospital.service.impl;

import br.com.saude_monitor.api.agregado.service.AgregadoService;
import br.com.saude_monitor.api.config.security.AutenticacaoHelper;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import br.com.saude_monitor.api.hospital.dto.HospitalResumoResponse;
import br.com.saude_monitor.api.hospital.dto.IndicadoresResponse;
import br.com.saude_monitor.api.hospital.dto.OrdemRanking;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.hospital.repository.SugestaoHospitalRepository;
import br.com.saude_monitor.api.hospital.service.GeofenceFactory;
import br.com.saude_monitor.api.hospital.service.GeofenceValidator;
import br.com.saude_monitor.api.hospital.service.HospitalService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Testes do ranking público de hospitais (E4-05).
 *
 * <p>Verifica a ordenação por nota média (desc) e por tempo médio (asc), a
 * paginação e o deslocamento de hospitais sem indicadores suficientes (RN-15)
 * para o final da lista, ordenados por nome.</p>
 */
class HospitalServiceImplTest {

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
        when(mongoTemplate.find(
                org.mockito.ArgumentMatchers.any(org.springframework.data.mongodb.core.query.Query.class),
                org.mockito.ArgumentMatchers.eq(HospitalDocument.class)))
                .thenAnswer(inv -> {
                    org.springframework.data.mongodb.core.query.Query query = inv.getArgument(0);
                    org.bson.Document criteria = query.getQueryObject();
                    Object tipoFilter = criteria.get("tipo");
                    List<HospitalDocument> todos = List.of(
                            hospital("h-nota5", "Mais Nota", TipoEstabelecimento.PUBLICO),
                            hospital("h-nota3", "Menos Nota", TipoEstabelecimento.PUBLICO),
                            hospital("h-tempo10", "Rapido", TipoEstabelecimento.PRIVADO),
                            hospital("h-tempo40", "Lento", TipoEstabelecimento.PRIVADO),
                            hospital("h-sem", "Sem Dados Z", TipoEstabelecimento.PUBLICO),
                            hospital("h-sem2", "Sem Dados A", TipoEstabelecimento.PUBLICO)
                    );
                    if (tipoFilter == null) {
                        return todos;
                    }
                    return todos.stream()
                            .filter(h -> String.valueOf(h.getTipo()).equals(String.valueOf(tipoFilter)))
                            .toList();
                });
        when(agregadoService.mapaIndicadores(org.mockito.ArgumentMatchers.anyCollection()))
                .thenAnswer(inv -> {
                    java.util.Collection<String> ids = inv.getArgument(0);
                    return ids.stream().map(id -> {
                        switch (id) {
                            case "h-nota5": return disp(5.0, 20);
                            case "h-nota3": return disp(3.0, 15);
                            case "h-tempo10": return disp(4.0, 10);
                            case "h-tempo40": return disp(4.5, 40);
                            default: return IndicadoresResponse.indisponivel();
                        }
                    }).toList();
                });
    }

    private HospitalDocument hospital(String id, String nome, TipoEstabelecimento tipo) {
        return HospitalDocument.builder().id(id).nome(nome).tipo(tipo).ativo(true).build();
    }

    private IndicadoresResponse disp(double nota, int tempo) {
        return new IndicadoresResponse(true, nota, 8, tempo, null);
    }

    @Test
    void rankingPorNotaOrdenaMaiorPrimeiroEPendentesAoFinal() {
        var result = service.ranking(OrdemRanking.NOTA, null, 0, 20);
        List<HospitalResumoResponse> content = result.content();
        assertThat(content).extracting(HospitalResumoResponse::nome)
                .containsExactly("Mais Nota", "Lento", "Rapido", "Menos Nota", "Sem Dados A", "Sem Dados Z");
    }

    @Test
    void rankingPorTempoOrdenaMenorPrimeiroEPendentesAoFinal() {
        var result = service.ranking(OrdemRanking.TEMPO, null, 0, 20);
        List<HospitalResumoResponse> content = result.content();
        assertThat(content).extracting(HospitalResumoResponse::nome)
                .containsExactly("Rapido", "Menos Nota", "Mais Nota", "Lento", "Sem Dados A", "Sem Dados Z");
    }

    @Test
    void rankingFiltraPorTipo() {
        var result = service.ranking(OrdemRanking.NOTA, TipoEstabelecimento.PRIVADO, 0, 20);
        assertThat(result.content()).extracting(HospitalResumoResponse::nome)
                .containsExactly("Lento", "Rapido");
        assertThat(result.totalElements()).isEqualTo(2);
    }

    @Test
    void rankingAplicaPaginacao() {
        var result = service.ranking(OrdemRanking.NOTA, null, 0, 2);
        assertThat(result.content()).hasSize(2);
        assertThat(result.content()).extracting(HospitalResumoResponse::nome)
                .containsExactly("Mais Nota", "Lento");
        assertThat(result.totalElements()).isEqualTo(6);
        assertThat(result.page()).isEqualTo(0);
        assertThat(result.size()).isEqualTo(2);
    }
}
