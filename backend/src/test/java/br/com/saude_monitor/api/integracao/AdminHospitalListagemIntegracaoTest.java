package br.com.saude_monitor.api.integracao;

import br.com.saude_monitor.api.config.security.JwtService;
import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import br.com.saude_monitor.api.hospital.service.GeofenceFactory;
import br.com.saude_monitor.api.user.document.Papel;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Autorização e filtro da listagem administrativa de hospitais (E7-02 / E7-07).
 *
 * <p>Prova, com o filtro de segurança real (não MockMvc standalone), que:</p>
 * <ul>
 *   <li>o contrato público {@code GET /api/v1/hospitais} <strong>nunca</strong> devolve inativo;</li>
 *   <li>{@code GET /api/v1/admin/hospitais} exige autenticação (401 sem token) e papel ADMIN
 *       (403 para USER comum);</li>
 *   <li>o ADMIN enxerga inativos, com o filtro {@code status} honrado (TODOS/ATIVOS/INATIVOS).</li>
 * </ul>
 *
 * <p>Contexto Spring completo de propósito: a decisão de autorização vive no
 * {@code SecurityConfig} + {@code JwtAuthenticationFilter}, que o harness standalone não instala.</p>
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
class AdminHospitalListagemIntegracaoTest extends IntegracaoTestBase {

    @Container
    static final MongoDBContainer mongo = new MongoDBContainer("mongo:7.0");

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", mongo::getReplicaSetUrl);
    }

    private static final String NOME_ATIVO = "Hospital Ativo Alpha";
    private static final String NOME_INATIVO = "Hospital Inativo Beta";

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void seed() {
        hospitalRepository.deleteAll();
        salvarHospital(NOME_ATIVO, true);
        salvarHospital(NOME_INATIVO, false);
    }

    private void salvarHospital(String nome, boolean ativo) {
        salvarHospital(nome, ativo, null);
    }

    private void salvarHospital(String nome, boolean ativo, String regiaoAdministrativa) {
        GeofenceFactory factory = new GeofenceFactory();
        hospitalRepository.save(HospitalDocument.builder()
                .nome(nome)
                .tipo(TipoEstabelecimento.PUBLICO)
                .categoria(CategoriaEstabelecimento.HOSPITAL)
                .localizacao(new GeoJsonPoint(LON, LAT))
                .geofence(factory.criarCirculo(LAT, LON, 150.0, GeofenceFactory.LADOS_CIRCULO))
                .regiaoAdministrativa(regiaoAdministrativa)
                .ativo(ativo)
                .build());
    }

    private String token(Papel papel, String email) {
        UserDocument usuario = userRepository.save(UserDocument.builder()
                .fullName("Usuário de teste")
                .email(email)
                .senhaHash(passwordEncoder.encode("Senha!123"))
                .papel(papel)
                .active(true)
                .build());
        return jwtService.generateAccessToken(usuario);
    }

    // ---------------------------------------------------------------
    // Contrato público permanece só-ativos
    // ---------------------------------------------------------------

    @Test
    void publicoNaoVeInativo() throws Exception {
        mockMvc.perform(get("/api/v1/hospitais"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].nome").value(NOME_ATIVO))
                .andExpect(jsonPath("$.content[0].ativo").value(true));
    }

    // ---------------------------------------------------------------
    // Autorização do caminho admin
    // ---------------------------------------------------------------

    @Test
    void adminSemTokenRetorna401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/hospitais"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminComUsuarioComumRetorna403() throws Exception {
        String tokenUser = token(Papel.USER, "usuario-comum-admin-hosp@saude-teste.com");
        mockMvc.perform(get("/api/v1/admin/hospitais")
                        .header("Authorization", "Bearer " + tokenUser))
                .andExpect(status().isForbidden());
    }

    // ---------------------------------------------------------------
    // ADMIN vê inativos, com o filtro de status honrado
    // ---------------------------------------------------------------

    @Test
    void adminSemStatusVeTodosInclusiveInativo() throws Exception {
        String tokenAdmin = token(Papel.ADMIN, "admin-todos-hosp@saude-teste.com");
        // Sem status → TODOS. Ordenação é por nome ASC: "Alpha" (ativo) antes de "Beta" (inativo).
        mockMvc.perform(get("/api/v1/admin/hospitais")
                        .header("Authorization", "Bearer " + tokenAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].nome").value(NOME_ATIVO))
                .andExpect(jsonPath("$.content[0].ativo").value(true))
                .andExpect(jsonPath("$.content[1].nome").value(NOME_INATIVO))
                .andExpect(jsonPath("$.content[1].ativo").value(false));
    }

    @Test
    void adminComStatusInativosVeApenasInativo() throws Exception {
        String tokenAdmin = token(Papel.ADMIN, "admin-inativos-hosp@saude-teste.com");
        mockMvc.perform(get("/api/v1/admin/hospitais")
                        .param("status", "INATIVOS")
                        .header("Authorization", "Bearer " + tokenAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].nome").value(NOME_INATIVO))
                .andExpect(jsonPath("$.content[0].ativo").value(false));
    }

    @Test
    void adminComStatusAtivosVeApenasAtivo() throws Exception {
        String tokenAdmin = token(Papel.ADMIN, "admin-ativos-hosp@saude-teste.com");
        mockMvc.perform(get("/api/v1/admin/hospitais")
                        .param("status", "ATIVOS")
                        .header("Authorization", "Bearer " + tokenAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].nome").value(NOME_ATIVO))
                .andExpect(jsonPath("$.content[0].ativo").value(true));
    }

    // ---------------------------------------------------------------
    // Filtro por região administrativa (E7-03)
    // ---------------------------------------------------------------

    @Test
    void adminComRegiaoFiltraApenasHospitaisDaquelaRegiao() throws Exception {
        hospitalRepository.deleteAll();
        salvarHospital("Hospital do Plano Piloto", true, "Plano Piloto");
        salvarHospital("Hospital do Recanto das Emas", true, "Recanto das Emas");
        String tokenAdmin = token(Papel.ADMIN, "admin-regiao-hosp@saude-teste.com");

        mockMvc.perform(get("/api/v1/admin/hospitais")
                        .param("regiaoAdministrativa", "Plano Piloto")
                        .header("Authorization", "Bearer " + tokenAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].nome").value("Hospital do Plano Piloto"))
                .andExpect(jsonPath("$.content[0].regiaoAdministrativa").value("Plano Piloto"));
    }

    @Test
    void adminSemRegiaoVeTodasIndependenteDaRegiao() throws Exception {
        hospitalRepository.deleteAll();
        salvarHospital("Hospital do Plano Piloto", true, "Plano Piloto");
        salvarHospital("Hospital do Recanto das Emas", true, "Recanto das Emas");
        String tokenAdmin = token(Papel.ADMIN, "admin-sem-regiao-hosp@saude-teste.com");

        mockMvc.perform(get("/api/v1/admin/hospitais")
                        .header("Authorization", "Bearer " + tokenAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
    }
}
