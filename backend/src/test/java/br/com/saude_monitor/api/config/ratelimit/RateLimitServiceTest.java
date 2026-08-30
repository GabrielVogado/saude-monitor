package br.com.saude_monitor.api.config.ratelimit;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Testes unitários do {@link RateLimitService} (F0-04): janela deslizante e limpeza.
 */
class RateLimitServiceTest {

    @Test
    void devePermitirAteOLimiteDoGrupo() {
        RateLimitService service = new RateLimitService();
        for (int i = 0; i < 10; i++) {
            assertThat(service.tentarConsumir("ip", RateLimitService.Grupo.AUTH)).isTrue();
        }
        assertThat(service.tentarConsumir("ip", RateLimitService.Grupo.AUTH)).isFalse();
    }

    @Test
    void deveManterContadoresIndependentesPorChave() {
        RateLimitService service = new RateLimitService();
        for (int i = 0; i < 60; i++) {
            service.tentarConsumir("ipA", RateLimitService.Grupo.PUBLICO);
        }
        assertThat(service.tentarConsumir("ipA", RateLimitService.Grupo.PUBLICO)).isFalse();
        assertThat(service.tentarConsumir("ipB", RateLimitService.Grupo.PUBLICO)).isTrue();
    }

    @Test
    void deveLimparJanelasObsoletas() {
        RateLimitService service = new RateLimitService();
        service.tentarConsumir("ip-antigo", RateLimitService.Grupo.PUBLICO);
        // Força o estado com janela antiga para validar a limpeza.
        long agora = System.currentTimeMillis();
        service.limparObsoletos(agora + (5 * RateLimitService.JANELA_MS));
        // Após limpar, a mesma chave pode consumir novamente.
        assertThat(service.tentarConsumir("ip-antigo", RateLimitService.Grupo.PUBLICO)).isTrue();
    }
}
