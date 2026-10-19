package br.com.saude_monitor.api.jobs;

import io.swagger.v3.oas.annotations.Hidden;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Disparo dos jobs pelo Cloud Scheduler (SOL-05).
 *
 * <p>Fora do contrato público ({@link Hidden}): só a conta de serviço do Cloud Scheduler,
 * com token OIDC, passa da {@link JobsSecurityConfig}. Respostas: 200 com
 * {@code EXECUTADO} ou {@code PULADO} (outra instância está rodando), 404 para nome
 * desconhecido e 500 quando o job falha, para o Cloud Scheduler tentar de novo.</p>
 */
@Hidden
@RestController
@RequestMapping("/internal/jobs")
@RequiredArgsConstructor
public class JobsController {

    private final ExecutorJobs executor;

    @PostMapping("/{nome}")
    public ResponseEntity<Map<String, String>> executar(@PathVariable String nome) {
        return executor.executar(nome)
                .map(resultado -> ResponseEntity.ok(Map.of("job", nome, "resultado", resultado.name())))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
