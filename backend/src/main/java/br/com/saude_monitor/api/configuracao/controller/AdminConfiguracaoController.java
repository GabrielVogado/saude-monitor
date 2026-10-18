package br.com.saude_monitor.api.configuracao.controller;

import br.com.saude_monitor.api.config.exception.NaoAutorizadoException;
import br.com.saude_monitor.api.config.security.AutenticacaoHelper;
import br.com.saude_monitor.api.configuracao.dto.ConfiguracaoRemotaRequest;
import br.com.saude_monitor.api.configuracao.dto.ConfiguracaoRemotaResponse;
import br.com.saude_monitor.api.configuracao.service.ConfiguracaoRemotaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 🛡️ Alteração da configuração remota (ARQ-09), só ADMIN ({@code /api/v1/admin/**} no
 * {@code SecurityConfig}). Continua aceita no modo somente leitura, para que o próprio
 * administrador possa desligá-lo.
 */
@RestController
@RequestMapping("/api/v1/admin/configuracao")
@RequiredArgsConstructor
public class AdminConfiguracaoController {

    private final ConfiguracaoRemotaService configuracaoRemotaService;
    private final AutenticacaoHelper autenticacaoHelper;

    @PutMapping
    public ResponseEntity<ConfiguracaoRemotaResponse> atualizar(@Valid @RequestBody ConfiguracaoRemotaRequest request) {
        String administradorId = autenticacaoHelper.usuarioIdAtual()
                .orElseThrow(() -> new NaoAutorizadoException("Usuário não autenticado."));
        return ResponseEntity.ok(configuracaoRemotaService.atualizar(request, administradorId));
    }
}
