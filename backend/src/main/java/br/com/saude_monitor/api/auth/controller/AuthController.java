package br.com.saude_monitor.api.auth.controller;

import br.com.saude_monitor.api.auth.dto.LoginRequest;
import br.com.saude_monitor.api.auth.dto.LoginResponse;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

	@PostMapping("/login")
	public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
		logger.info("[AuthController] Requisicao de login recebida do frontend para email={} rememberDevice={}",
			request.email(),
			request.rememberDevice());

		LoginResponse response = new LoginResponse(
			true,
			"login payload received",
			request.email(),
			request.rememberDevice()
		);

		logger.info("[AuthController] Resposta de login enviada com sucesso para email={}", request.email());
		return ResponseEntity.ok(response);
	}
}
