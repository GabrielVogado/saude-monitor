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

    private ConfiguracaoRemotaService servico(ContencaoProperties props) {
        return new ConfiguracaoRemotaService(repository, props, relogio);
    }

    private static Optional<ConfiguracaoRemotaDocument> gravada(boolean somenteLeitura, String versao) {
        return Optional.of(ConfiguracaoRemotaDocument.builder()
                .id(ConfiguracaoRemotaDocument.ID_UNICO).modoSomenteLeitura(somenteLeitura)
                .versaoMinimaApp(versao).mensagem("aviso").build());
    }

    @Test
    void semDocumentoValeOPadrao() {
        when(repository.findById(ConfiguracaoRemotaDocument.ID_UNICO)).thenReturn(Optional.empty());

        assertThat(servico(NORMAL).obter()).isEqualTo(ConfiguracaoRemotaResponse.PADRAO);
    }

    @Test
    void leODocumentoUmaVezPorValidade() {
        when(repository.findById(ConfiguracaoRemotaDocument.ID_UNICO)).thenReturn(gravada(true, "1.2.0"));
        ConfiguracaoRemotaService servico = servico(NORMAL);

        assertThat(servico.obter()).isEqualTo(new ConfiguracaoRemotaResponse(true, "1.2.0", "aviso"));
        relogio.avancarSegundos(29);
        assertThat(servico.modoSomenteLeitura()).isTrue();
        verify(repository, times(1)).findById(ConfiguracaoRemotaDocument.ID_UNICO);

        relogio.avancarSegundos(1);
        servico.obter();
        verify(repository, times(2)).findById(ConfiguracaoRemotaDocument.ID_UNICO);
    }

    @Test
    void bancoForaMantemOUltimoValorLido() {
        when(repository.findById(ConfiguracaoRemotaDocument.ID_UNICO))
                .thenReturn(gravada(true, null))
                .thenThrow(new DataAccessResourceFailureException("fora"));
        ConfiguracaoRemotaService servico = servico(NORMAL);
        servico.obter();
        relogio.avancarSegundos(31);

        assertThat(servico.modoSomenteLeitura()).isTrue();
    }

    @Test
    void bancoForaSemNadaLidoCaiNoPadrao() {
        when(repository.findById(ConfiguracaoRemotaDocument.ID_UNICO)).thenThrow(new DataAccessResourceFailureException("fora"));

        assertThat(servico(NORMAL).obter()).isEqualTo(ConfiguracaoRemotaResponse.PADRAO);
    }

    @Test
    void variavelDeAmbienteForcaOModoSomenteLeitura() {
        when(repository.findById(ConfiguracaoRemotaDocument.ID_UNICO)).thenReturn(gravada(false, "1.0.0"));

        ConfiguracaoRemotaResponse resposta = servico(new ContencaoProperties(80, 5, 300, true)).obter();

        assertThat(resposta).isEqualTo(new ConfiguracaoRemotaResponse(true, "1.0.0", "aviso"));
    }

    @Test
    void atualizarGravaQuemAlterouEValeNaHoraNestaInstancia() {
        when(repository.findById(ConfiguracaoRemotaDocument.ID_UNICO)).thenReturn(Optional.empty());
        ConfiguracaoRemotaService servico = servico(NORMAL);
        servico.obter();

        ConfiguracaoRemotaResponse resposta = servico.atualizar(
                new ConfiguracaoRemotaRequest(true, "1.1.0", "Manutenção"), "admin-1");

        ArgumentCaptor<ConfiguracaoRemotaDocument> gravado = ArgumentCaptor.forClass(ConfiguracaoRemotaDocument.class);
        verify(repository).save(gravado.capture());
        assertThat(gravado.getValue().getId()).isEqualTo(ConfiguracaoRemotaDocument.ID_UNICO);
        assertThat(gravado.getValue().getAtualizadoPor()).isEqualTo("admin-1");
        assertThat(gravado.getValue().getAtualizadoEm()).isEqualTo(AGORA);
        assertThat(resposta).isEqualTo(new ConfiguracaoRemotaResponse(true, "1.1.0", "Manutenção"));
        assertThat(servico.modoSomenteLeitura()).isTrue();
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
