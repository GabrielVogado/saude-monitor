package br.com.saude_monitor.api.configuracao.service;

import br.com.saude_monitor.api.config.contencao.ContencaoProperties;
import br.com.saude_monitor.api.configuracao.document.ConfiguracaoRemotaDocument;
import br.com.saude_monitor.api.configuracao.dto.ConfiguracaoRemotaRequest;
import br.com.saude_monitor.api.configuracao.dto.ConfiguracaoRemotaResponse;
import br.com.saude_monitor.api.configuracao.repository.ConfiguracaoRemotaRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataAccessResourceFailureException;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Configuração remota com releitura a cada 30 s e queda segura (ARQ-09). */
class ConfiguracaoRemotaServiceTest {

    private static final Instant AGORA = Instant.parse("2026-10-18T12:00:00Z");
    private static final ContencaoProperties NORMAL = new ContencaoProperties(80, 5, 300, false);

    private final ConfiguracaoRemotaRepository repository = mock(ConfiguracaoRemotaRepository.class);
    private final RelogioAjustavel relogio = new RelogioAjustavel();

    private ConfiguracaoRemotaService criarServico(ContencaoProperties props) {
        return new ConfiguracaoRemotaService(repository, props, relogio);
    }

    private static Optional<ConfiguracaoRemotaDocument> criarConfiguracaoGravada(boolean somenteLeitura, String versao) {
        return Optional.of(ConfiguracaoRemotaDocument.builder()
                .id(ConfiguracaoRemotaDocument.ID_UNICO).modoSomenteLeitura(somenteLeitura)
                .versaoMinimaApp(versao).mensagem("aviso").build());
    }

    @Test
    void semDocumentoValeOPadrao() {
        when(repository.findById(ConfiguracaoRemotaDocument.ID_UNICO)).thenReturn(Optional.empty());

        assertThat(criarServico(NORMAL).obterConfiguracao()).isEqualTo(ConfiguracaoRemotaResponse.PADRAO);
    }

    @Test
    void leODocumentoUmaVezPorValidade() {
        when(repository.findById(ConfiguracaoRemotaDocument.ID_UNICO)).thenReturn(criarConfiguracaoGravada(true, "1.2.0"));
        ConfiguracaoRemotaService servico = criarServico(NORMAL);

        assertThat(servico.obterConfiguracao()).isEqualTo(new ConfiguracaoRemotaResponse(true, "1.2.0", "aviso"));
        relogio.avancarSegundos(29);
        assertThat(servico.isModoSomenteLeitura()).isTrue();
        verify(repository, times(1)).findById(ConfiguracaoRemotaDocument.ID_UNICO);

        relogio.avancarSegundos(1);
        servico.obterConfiguracao();
        verify(repository, times(2)).findById(ConfiguracaoRemotaDocument.ID_UNICO);
    }

    @Test
    void bancoForaMantemOUltimoValorLido() {
        when(repository.findById(ConfiguracaoRemotaDocument.ID_UNICO))
                .thenReturn(criarConfiguracaoGravada(true, null))
                .thenThrow(new DataAccessResourceFailureException("fora"));
        ConfiguracaoRemotaService servico = criarServico(NORMAL);
        servico.obterConfiguracao();
        relogio.avancarSegundos(31);

        assertThat(servico.isModoSomenteLeitura()).isTrue();
    }

    @Test
    void bancoForaSemNadaLidoCaiNoPadrao() {
        when(repository.findById(ConfiguracaoRemotaDocument.ID_UNICO)).thenThrow(new DataAccessResourceFailureException("fora"));

        assertThat(criarServico(NORMAL).obterConfiguracao()).isEqualTo(ConfiguracaoRemotaResponse.PADRAO);
    }

    @Test
    void variavelDeAmbienteForcaOModoSomenteLeitura() {
        when(repository.findById(ConfiguracaoRemotaDocument.ID_UNICO)).thenReturn(criarConfiguracaoGravada(false, "1.0.0"));

        ConfiguracaoRemotaResponse resposta = criarServico(new ContencaoProperties(80, 5, 300, true)).obterConfiguracao();

        assertThat(resposta).isEqualTo(new ConfiguracaoRemotaResponse(true, "1.0.0", "aviso"));
    }

    @Test
    void atualizarGravaQuemAlterouEValeNaHoraNestaInstancia() {
        when(repository.findById(ConfiguracaoRemotaDocument.ID_UNICO)).thenReturn(Optional.empty());
        ConfiguracaoRemotaService servico = criarServico(NORMAL);
        servico.obterConfiguracao();

        ConfiguracaoRemotaResponse resposta = servico.atualizar(
                new ConfiguracaoRemotaRequest(true, "1.1.0", "Manutenção"), "admin-1");

        ArgumentCaptor<ConfiguracaoRemotaDocument> gravado = ArgumentCaptor.forClass(ConfiguracaoRemotaDocument.class);
        verify(repository).save(gravado.capture());
        assertThat(gravado.getValue().getId()).isEqualTo(ConfiguracaoRemotaDocument.ID_UNICO);
        assertThat(gravado.getValue().getAtualizadoPor()).isEqualTo("admin-1");
        assertThat(gravado.getValue().getAtualizadoEm()).isEqualTo(AGORA);
        assertThat(resposta).isEqualTo(new ConfiguracaoRemotaResponse(true, "1.1.0", "Manutenção"));
        assertThat(servico.isModoSomenteLeitura()).isTrue();
        verify(repository, times(1)).findById(ConfiguracaoRemotaDocument.ID_UNICO);
    }

    /** Relógio que o teste adianta. */
    private static final class RelogioAjustavel extends Clock {
        private Instant agora = AGORA;

        void avancarSegundos(long segundos) {
            agora = agora.plusSeconds(segundos);
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return agora;
        }
    }
}
