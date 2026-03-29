package br.com.saude_monitor.api.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
	@NotBlank(message = "email is required") String email,
	@NotBlank(message = "password is required") String password,
	boolean rememberDevice
) {
}

