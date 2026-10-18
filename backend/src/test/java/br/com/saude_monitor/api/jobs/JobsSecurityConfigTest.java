package br.com.saude_monitor.api.jobs;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import jakarta.servlet.Filter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.function.UnaryOperator;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Só o token OIDC da conta de serviço do Cloud Scheduler dispara job (SOL-05). Os tokens são
 * assinados com uma chave local, no lugar das chaves do Google.
 */
@SpringJUnitWebConfig(JobsSecurityConfigTest.Contexto.class)
class JobsSecurityConfigTest {

    static final String AUDIENCIA = "https://saude-monitor-backend.run.app";
    static final String CONTA = "agendador@saude-monitor.iam.gserviceaccount.com";
    static final KeyPair CHAVES = gerarChaves();

    @Autowired
    private WebApplicationContext contexto;

    @Autowired
    private ExecutorJobs executor;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        reset(executor);
        when(executor.executar("indicadores")).thenReturn(Optional.of(ExecutorJobs.Resultado.EXECUTADO));
        when(executor.executar("inexistente")).thenReturn(Optional.empty());
        mockMvc = MockMvcBuilders.webAppContextSetup(contexto)
                .addFilters(contexto.getBean("springSecurityFilterChain", Filter.class))
                .build();
    }

    private static KeyPair gerarChaves() {
        try {
            KeyPairGenerator gerador = KeyPairGenerator.getInstance("RSA");
            gerador.initialize(2048);
            return gerador.generateKeyPair();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static JWTClaimsSet.Builder claimsValidas() {
        Instant agora = Instant.now();
        return new JWTClaimsSet.Builder()
                .issuer("https://accounts.google.com")
                .audience(AUDIENCIA)
                .subject("1234567890")
                .claim("email", CONTA)
                .claim("email_verified", true)
                .issueTime(Date.from(agora))
                .expirationTime(Date.from(agora.plusSeconds(300)));
    }

    private static String token(UnaryOperator<JWTClaimsSet.Builder> ajuste) throws Exception {
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.RS256), ajuste.apply(claimsValidas()).build());
        jwt.sign(new RSASSASigner(CHAVES.getPrivate()));
        return jwt.serialize();
    }

    private void esperarRecusa(String token) throws Exception {
        mockMvc.perform(post("/internal/jobs/indicadores").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenDaContaDoAgendadorDisparaOJob() throws Exception {
        mockMvc.perform(post("/internal/jobs/indicadores").header("Authorization", "Bearer " + token(c -> c)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.job").value("indicadores"))
                .andExpect(jsonPath("$.resultado").value("EXECUTADO"));
    }

    @Test
    void emissorSemEsquemaTambemEhOGoogle() throws Exception {
        mockMvc.perform(post("/internal/jobs/indicadores")
                        .header("Authorization", "Bearer " + token(c -> c.issuer("accounts.google.com"))))
                .andExpect(status().isOk());
    }

    @Test
    void nomeDesconhecidoDa404() throws Exception {
        mockMvc.perform(post("/internal/jobs/inexistente").header("Authorization", "Bearer " + token(c -> c)))
                .andExpect(status().isNotFound());
    }

    @Test
    void semTokenEhRecusado() throws Exception {
        // Sem Bearer, o CSRF (que o resource server só dispensa com Bearer) recusa antes.
        mockMvc.perform(post("/internal/jobs/indicadores")).andExpect(status().isForbidden());
    }

    @Test
    void outraContaEhRecusada() throws Exception {
        esperarRecusa(token(c -> c.claim("email", "intruso@outro-projeto.iam.gserviceaccount.com")));
    }

    @Test
    void emailNaoVerificadoEhRecusado() throws Exception {
        esperarRecusa(token(c -> c.claim("email_verified", false)));
    }

    @Test
    void outraAudienciaEhRecusada() throws Exception {
        esperarRecusa(token(c -> c.audience("https://outro-servico.run.app")));
    }

    @Test
    void outroEmissorEhRecusado() throws Exception {
        esperarRecusa(token(c -> c.issuer("https://emissor-falso.example")));
    }

    @Test
    void tokenVencidoEhRecusado() throws Exception {
        Instant antes = Instant.now().minusSeconds(3600);
        esperarRecusa(token(c -> c.issueTime(Date.from(antes)).expirationTime(Date.from(antes.plusSeconds(300)))));
    }

    @Test
    void tokenAssinadoPorOutraChaveEhRecusado() throws Exception {
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.RS256), claimsValidas().build());
        jwt.sign(new RSASSASigner(gerarChaves().getPrivate()));
        esperarRecusa(jwt.serialize());
    }

    @Configuration
    @EnableWebMvc
    @EnableWebSecurity
    @Import(JobsController.class)
    static class Contexto {

        @Bean
        ExecutorJobs executorJobs() {
            return mock(ExecutorJobs.class);
        }

        @Bean
        SecurityFilterChain jobs(HttpSecurity http) {
            JobsProperties properties = new JobsProperties(false, AUDIENCIA, CONTA);
            NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey((RSAPublicKey) CHAVES.getPublic()).build();
            decoder.setJwtValidator(JobsSecurityConfig.validador(properties));
            return JobsSecurityConfig.cadeia(http, properties, decoder);
        }
    }
}
