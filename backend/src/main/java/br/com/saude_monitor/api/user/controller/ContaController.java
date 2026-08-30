package br.com.saude_monitor.api.user.controller;

import br.com.saude_monitor.api.config.exception.NaoAutorizadoException;
import br.com.saude_monitor.api.config.security.AutenticacaoHelper;
import br.com.saude_monitor.api.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Gestão da conta do usuário autenticado (F0-05 — LGPD).
 *
 * <p>O endpoint é autenticado (cai na regra {@code anyRequest().authenticated()}
 * do {@code SecurityConfig}) e permite ao usuário excluir os próprios dados
 * pessoais (exclusão de conta), com anonimização dos dados estatísticos.</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/contas")
@RequiredArgsConstructor
public class ContaController {

    private final UserService userService;
    private final AutenticacaoHelper autenticacaoHelper;

    /**
     * 🔒 Exclui a conta e os dados pessoais do usuário autenticado (F0-05/LGPD).
     * Visitas e feedbacks são anonimizados; agregados públicos são preservados.
     */
    @DeleteMapping("/exclusao")
    public ResponseEntity<Map<String, Object>> excluirConta() {
        String usuarioId = autenticacaoHelper.usuarioIdAtual()
                .orElseThrow(() -> new NaoAutorizadoException("Usuário não autenticado."));

        userService.excluirConta(usuarioId);

        log.info("Conta do usuário {} excluída via endpoint de autogerenciamento (LGPD).", usuarioId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Conta excluída com sucesso. Seus dados pessoais foram removidos."
        ));
    }
}
