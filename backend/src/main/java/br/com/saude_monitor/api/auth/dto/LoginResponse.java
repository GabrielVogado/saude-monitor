package br.com.saude_monitor.api.auth.dto;

public record LoginResponse(
	boolean success,
	String message,
	String email,
	boolean rememberDevice
) {
}

