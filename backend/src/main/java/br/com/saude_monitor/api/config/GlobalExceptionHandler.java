package br.com.saude_monitor.api.config;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

	private record ValidationErrorResponse(
		boolean success,
		String message,
		Map<String, String> errors
	) {}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ValidationErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
		var fieldErrors = exception.getBindingResult().getFieldErrors()
			.stream()
			.collect(Collectors.toMap(
				FieldError::getField,
				FieldError::getDefaultMessage,
				(existing, _) -> existing,
				LinkedHashMap::new
			));

		return ResponseEntity
			.status(HttpStatus.BAD_REQUEST)
			.body(new ValidationErrorResponse(false, "validation failed", fieldErrors));
	}
}
