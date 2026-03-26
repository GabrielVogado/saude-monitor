package br.com.saude_monitor.api.user.dto;

import java.time.Instant;

public record UserResponse(
	boolean success,
	String message,
	String id,
	String fullName,
	String email,
	String phone,
	boolean active,
	Instant createdAt,
	Instant updatedAt
) {
}
