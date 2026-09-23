package br.com.saude_monitor.api.integracao;

import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.hospital.service.GeofenceFactory;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Base comum dos testes de integração dos fluxos críticos (E8-10 — DOD-03): agrupa só o
 * que é seguro compartilhar entre classes — injeção de {@code MockMvc}/{@code ObjectMapper}
 * e o fixture de hospital ativo — sem tentar compartilhar Testcontainers/contexto Spring
 * entre elas.
 *
 * <p><strong>Por que cada classe mantém seu próprio {@code @Testcontainers}/{@code @SpringBootTest}:</strong>
 * chegou a ser tentado um container "singleton" compartilhado entre as três classes desta
 * entrega. Ele resolveu o problema de infraestrutura (Mongo), mas expôs um segundo: o
 * rate limiter de login/refresh é um {@code ConcurrentHashMap} em memória (OPS-02) — com
 * o contexto Spring reaproveitado entre classes, as chamadas de uma classe consomem a
 * cota da próxima, e os testes de auth passam a falhar com 429 **dependendo da ordem de
 * execução**. Isolar o contexto por classe é o padrão já usado no resto da suíte
 * ({@code SaudeMonitorApplicationTests}, {@code CriacaoDeIndicesTest}) e evita essa classe
 * de falha por inteiro, ao custo de cada classe subir seu próprio container/contexto.</p>
 */
abstract class IntegracaoTestBase {

    protected static final double LAT = -15.9023;
    protected static final double LON = -48.0742;

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    protected HospitalRepository hospitalRepository;

    /** Hospital ativo válido, com geofence real, pronto para receber check-in. */
    protected String hospitalAtivo() {
        GeofenceFactory factory = new GeofenceFactory();
        HospitalDocument hospital = hospitalRepository.save(HospitalDocument.builder()
                .nome("Hospital de Teste da Integração")
                .tipo(TipoEstabelecimento.PUBLICO)
                .categoria(CategoriaEstabelecimento.HOSPITAL)
                .localizacao(new GeoJsonPoint(LON, LAT))
                .geofence(factory.criarCirculo(LAT, LON, 150.0, GeofenceFactory.LADOS_CIRCULO))
                .ativo(true)
                .build());
        return hospital.getId();
    }
}
