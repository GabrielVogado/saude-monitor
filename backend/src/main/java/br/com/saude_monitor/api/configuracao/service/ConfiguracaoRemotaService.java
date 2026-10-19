package br.com.saude_monitor.api.configuracao.service;

import br.com.saude_monitor.api.config.contencao.ContencaoProperties;
import br.com.saude_monitor.api.configuracao.document.ConfiguracaoRemotaDocument;
import br.com.saude_monitor.api.configuracao.dto.ConfiguracaoRemotaRequest;
import br.com.saude_monitor.api.configuracao.dto.ConfiguracaoRemotaResponse;
import br.com.saude_monitor.api.configuracao.repository.ConfiguracaoRemotaRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Configuração remota da operação (ARQ-09): modo somente leitura e versão mínima do app,
 * trocados sem novo deploy.
 *
 * <p>Cada instância relê o documento no máximo a cada {@link #VALIDADE}; uma alteração leva
 * até esse tempo para valer em todas. Se o banco falhar na releitura, a instância segue com o
 * último valor lido (e tenta de novo depois da mesma validade), para a falha do banco não
 * desligar sozinha um modo somente leitura que estava ligado.</p>
 *
 * <p>{@link ContencaoProperties#somenteLeituraForcado()} liga o modo somente leitura por
 * variável de ambiente, para quando o banco nem pode ser lido.</p>
 */
@Slf4j
@Service
public class ConfiguracaoRemotaService {

    /** Por quanto tempo cada instância reaproveita a configuração lida. */
    public static final Duration VALIDADE = Duration.ofSeconds(30);

    private final ConfiguracaoRemotaRepository repository;
    private final ContencaoProperties contencao;
    private final Clock clock;

    private final AtomicReference<Guardada> guardada = new AtomicReference<>();

    @Autowired
    public ConfiguracaoRemotaService(ConfiguracaoRemotaRepository repository, ContencaoProperties contencao) {
        this(repository, contencao, Clock.systemUTC());
    }

    ConfiguracaoRemotaService(ConfiguracaoRemotaRepository repository, ContencaoProperties contencao, Clock clock) {
        this.repository = repository;
        this.contencao = contencao;
        this.clock = clock;
    }

    /** Configuração em vigor, com o modo somente leitura forçado por ambiente já aplicado. */
    public ConfiguracaoRemotaResponse obterConfiguracao() {
        ConfiguracaoRemotaResponse lida = obterConfiguracaoGuardada();
        if (contencao.somenteLeituraForcado() && !lida.modoSomenteLeitura()) {
            return new ConfiguracaoRemotaResponse(true, lida.versaoMinimaApp(), lida.mensagem());
        }
        return lida;
    }

    /** Atalho para filtros e jobs. */
    public boolean isModoSomenteLeitura() {
        return obterConfiguracao().modoSomenteLeitura();
    }

    /** Grava a nova configuração e passa a usá-la nesta instância na hora. */
    public ConfiguracaoRemotaResponse atualizar(ConfiguracaoRemotaRequest request, String administradorId) {
        ConfiguracaoRemotaDocument documento = ConfiguracaoRemotaDocument.builder()
                .id(ConfiguracaoRemotaDocument.ID_UNICO)
                .modoSomenteLeitura(request.modoSomenteLeitura())
                .versaoMinimaApp(request.versaoMinimaApp())
                .mensagem(request.mensagem())
                .atualizadoEm(clock.instant())
                .atualizadoPor(administradorId)
                .build();
        repository.save(documento);
        log.info("[Configuracao] alterada por {}: somente leitura={}, versão mínima={}.",
                administradorId, documento.isModoSomenteLeitura(), documento.getVersaoMinimaApp());
        ConfiguracaoRemotaResponse nova = converterParaResposta(documento);
        guardada.set(new Guardada(nova, clock.instant().plus(VALIDADE)));
        return obterConfiguracao();
    }

    private ConfiguracaoRemotaResponse obterConfiguracaoGuardada() {
        Guardada atual = guardada.get();
        if (atual != null && clock.instant().isBefore(atual.expiraEm())) {
            return atual.configuracao();
        }
        return relerDoBanco();
    }

    private synchronized ConfiguracaoRemotaResponse relerDoBanco() {
        Instant agora = clock.instant();
        Guardada atual = guardada.get();
        if (atual != null && agora.isBefore(atual.expiraEm())) {
            return atual.configuracao(); // outra thread releu enquanto esta esperava
        }
        ConfiguracaoRemotaResponse configuracao;
        try {
            configuracao = repository.findById(ConfiguracaoRemotaDocument.ID_UNICO)
                    .map(ConfiguracaoRemotaService::converterParaResposta)
                    .orElse(ConfiguracaoRemotaResponse.PADRAO);
        } catch (DataAccessException e) {
            configuracao = atual != null ? atual.configuracao() : ConfiguracaoRemotaResponse.PADRAO;
            log.warn("[Configuracao] banco indisponível; mantida a configuração anterior: {}", e.getMessage());
        }
        guardada.set(new Guardada(configuracao, agora.plus(VALIDADE)));
        return configuracao;
    }

    private static ConfiguracaoRemotaResponse converterParaResposta(ConfiguracaoRemotaDocument documento) {
        return new ConfiguracaoRemotaResponse(
                documento.isModoSomenteLeitura(), documento.getVersaoMinimaApp(), documento.getMensagem());
    }

    private record Guardada(ConfiguracaoRemotaResponse configuracao, Instant expiraEm) {
    }
}
