package br.com.saude_monitor.api.hospital.controller;

import br.com.saude_monitor.api.config.exception.GlobalExceptionHandler;
import br.com.saude_monitor.api.hospital.document.StatusSugestao;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import br.com.saude_monitor.api.hospital.dto.GeoJsonPolygonDto;
import br.com.saude_monitor.api.hospital.dto.HospitalRequest;
import br.com.saude_monitor.api.hospital.dto.HospitalResumoResponse;
import br.com.saude_monitor.api.hospital.dto.HospitalResponse;
import br.com.saude_monitor.api.hospital.dto.IndicadoresResponse;
import br.com.saude_monitor.api.hospital.dto.PageResponse;
import br.com.saude_monitor.api.config.security.AutenticacaoHelper;
import br.com.saude_monitor.api.hospital.dto.AprovarSugestaoRequest;
import br.com.saude_monitor.api.hospital.dto.RejeitarSugestaoRequest;
import br.com.saude_monitor.api.hospital.dto.SugestaoHospitalDetalheResponse;
import br.com.saude_monitor.api.hospital.dto.SugestaoHospitalRequest;
import br.com.saude_monitor.api.hospital.dto.SugestaoHospitalResponse;
import br.com.saude_monitor.api.hospital.service.HospitalService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.time.Instant;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Testes de integração do controller (standalone MockMvc), sem dependência de MongoDB.
 *
 * <p>Valida o roteamento dos endpoints, a validação de corpo (Bean Validation) e o
 * envelope de erro padrão.</p>
 */
class HospitalControllerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        HospitalService service = new StubService();
        AutenticacaoHelper authHelper = new AutenticacaoHelper(null) {
            @Override
            public java.util.Optional<String> usuarioIdAtual() {
                return java.util.Optional.of("admin-123");
            }
        };

        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders.standaloneSetup(new HospitalController(service, authHelper))
                .setValidator(validator)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void deveListarHospitais() throws Exception {
        mockMvc.perform(get("/api/v1/hospitais"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void deveCriarHospitalComSucesso() throws Exception {
        String body = """
                {
                  "nome": "Hospital Teste",
                  "cnpj": "12.345.678/0001-90",
                  "tipo": "PUBLICO",
                  "categoria": "HOSPITAL",
                  "endereco": { "logradouro": "Rua A", "numero": "100", "cidade": "Brasília", "uf": "DF", "cep": "70000-000" },
                  "contato": { "telefone": "(61) 3325-5000", "email": "contato@teste.com" },
                  "geofence": { "type": "Polygon", "coordinates": [[[-47.88,-15.78],[-47.87,-15.78],[-47.87,-15.77],[-47.88,-15.78]]] }
                }
                """;

        mockMvc.perform(post("/api/v1/hospitais")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("1"))
                .andExpect(jsonPath("$.nome").value("Hospital Teste"));
    }

    @Test
    void deveRetornar400ComEnvelopePadraoQuandoNomeAusente() throws Exception {
        String body = """
                {
                  "tipo": "PUBLICO",
                  "endereco": { "logradouro": "Rua A", "cidade": "Brasília", "uf": "DF" },
                  "geofence": { "type": "Polygon", "coordinates": [[[-47.88,-15.78],[-47.87,-15.78],[-47.87,-15.77],[-47.88,-15.78]]] }
                }
                """;

        mockMvc.perform(post("/api/v1/hospitais")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("CAMPOS_INVALIDOS"))
                .andExpect(jsonPath("$.traceId").exists());
    }

    @Test
    void deveListarSugestoesAdmin() throws Exception {
        mockMvc.perform(get("/api/v1/hospitais/sugestoes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void deveRejeitarSugestaoComMotivoCurtoRetornar400() throws Exception {
        String body = """
                {
                  "motivo": "ok"
                }
                """;

        mockMvc.perform(post("/api/v1/hospitais/sugestoes/1/rejeitar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("CAMPOS_INVALIDOS"));
    }

    @Test
    void deveAprovarSugestaoComHospitalId() throws Exception {
        String body = """
                {
                  "hospitalId": "hosp-123"
                }
                """;

        mockMvc.perform(post("/api/v1/hospitais/sugestoes/1/aprovar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());
    }

    /** Stub manual do serviço, evita dependência de Mockito/MongoDB. */
    private static class StubService implements HospitalService {

        @Override
        public HospitalResponse criar(HospitalRequest request) {
            return new HospitalResponse("1", request.nome(), request.cnpj(), request.tipo(),
                    request.categoria(), null, null, null, null, null,
                    request.endereco(), request.contato(), request.geofence(),
                    true, IndicadoresResponse.indisponivel(), Instant.now(), Instant.now());
        }

        @Override
        public HospitalResponse atualizar(String id, HospitalRequest request) {
            return criar(request);
        }

        @Override
        public HospitalResponse buscarPorId(String id) {
            return null;
        }

        @Override
        public GeoJsonPolygonDto buscarGeofence(String id) {
            return null;
        }

        @Override
        public PageResponse<HospitalResumoResponse> listar(Double latitude, Double longitude, Double raioKm,
                                                           TipoEstabelecimento tipo, String busca, int page, int size) {
            return PageResponse.of(List.of(), page, size, 0);
        }

        @Override
        public HospitalResponse alterarStatus(String id, boolean ativo) {
            return null;
        }

        @Override
        public SugestaoHospitalResponse sugerir(SugestaoHospitalRequest request) {
            return new SugestaoHospitalResponse(
                    "1", request.nome(), request.endereco(), request.observacao(),
                    StatusSugestao.PENDENTE, Instant.now());
        }

        @Override
        public PageResponse<SugestaoHospitalDetalheResponse> listarSugestoes(StatusSugestao status, int page, int size) {
            return PageResponse.of(List.of(), page, size, 0);
        }

        @Override
        public SugestaoHospitalDetalheResponse buscarSugestaoPorId(String id) {
            return null;
        }

        @Override
        public SugestaoHospitalDetalheResponse aprovarSugestao(String id, AprovarSugestaoRequest request, String adminId) {
            return null;
        }

        @Override
        public SugestaoHospitalDetalheResponse rejeitarSugestao(String id, RejeitarSugestaoRequest request, String adminId) {
            return null;
        }
    }
}
