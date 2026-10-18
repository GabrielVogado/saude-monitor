package br.com.saude_monitor.api.configuracao.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Alteração da configuração remota pelo administrador (ARQ-09). Substitui o documento
 * inteiro: campo ausente volta ao padrão.
 */
public record ConfiguracaoRemotaRequest(
        @NotNull Boolean modoSomenteLeitura,
        @Pattern(regexp = "\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}", message = "use o formato 1.2.3")
        String versaoMinimaApp,
        @Size(max = 200) String mensagem
) {
}
