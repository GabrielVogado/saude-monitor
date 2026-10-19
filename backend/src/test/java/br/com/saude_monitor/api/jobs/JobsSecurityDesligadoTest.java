package br.com.saude_monitor.api.jobs;

import jakarta.servlet.Filter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Sem audiência e conta configuradas, a rota de jobs recusa tudo (SOL-05). */
@SpringJUnitWebConfig(JobsSecurityDesligadoTest.Contexto.class)
class JobsSecurityDesligadoTest {

    @Autowired
    private WebApplicationContext contexto;

    @Autowired
    private ExecutorJobs executor;

    @Test
    void semConfiguracaoNenhumaChamadaPassa() throws Exception {
        MockMvcBuilders.webAppContextSetup(contexto)
                .addFilters(contexto.getBean("springSecurityFilterChain", Filter.class))
                .build()
                .perform(post("/internal/jobs/indicadores").header("Authorization", "Bearer qualquer-coisa"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(executor);
    }

    @Test
    void endpointsSoFicamHabilitadosComAudienciaEConta() {
        assertThat(new JobsProperties(true, null, null).isEndpointsHabilitados()).isFalse();
        assertThat(new JobsProperties(true, "https://api", " ").isEndpointsHabilitados()).isFalse();
        assertThat(new JobsProperties(true, "", "conta@x").isEndpointsHabilitados()).isFalse();
        assertThat(new JobsProperties(true, "https://api", "conta@x").isEndpointsHabilitados()).isTrue();
    }

    @Test
    void decodificadorDoGoogleEhMontadoSemIrARede() {
        assertThat(JobsSecurityConfig.criarDecoderGoogle(new JobsProperties(false, "https://api", "conta@x"))).isNotNull();
    }

    @Configuration
    @EnableWebMvc
    @EnableWebSecurity
    @Import({JobsController.class, JobsSecurityConfig.class})
    static class Contexto {

        @Bean
        ExecutorJobs executorJobs() {
            return mock(ExecutorJobs.class);
        }

        @Bean
        JobsProperties jobsProperties() {
            return new JobsProperties(true, "", "");
        }
    }
}
