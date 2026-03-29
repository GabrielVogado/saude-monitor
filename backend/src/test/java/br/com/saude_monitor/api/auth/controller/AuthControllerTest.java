package br.com.saude_monitor.api.auth.controller;

import br.com.saude_monitor.api.auth.dto.LoginResponse;
import br.com.saude_monitor.api.auth.service.AuthService;
import br.com.saude_monitor.api.config.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthControllerTest {

	private final AuthService authService = request -> new LoginResponse(
		true,
		"login payload received",
		request.email(),
		request.rememberDevice()
	);

	private final MockMvc mockMvc = MockMvcBuilders
		.standaloneSetup(new AuthController(authService))
		.setControllerAdvice(new GlobalExceptionHandler())
		.build();

	@Test
	void shouldReceiveLoginPayload() throws Exception {
		String payload = """
			{
			  "email": "usuario@teste.com",
			  "password": "senha123",
			  "rememberDevice": true
			}
			""";

		mockMvc.perform(post("/api/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content(payload))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.email").value("usuario@teste.com"))
			.andExpect(jsonPath("$.rememberDevice").value(true));
	}

	@Test
	void shouldReturn400WhenEmailOrPasswordAreMissing() throws Exception {
		String payload = """
			{
			  "email": "",
			  "password": "",
			  "rememberDevice": false
			}
			""";

		mockMvc.perform(post("/api/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content(payload))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.success").value(false))
			.andExpect(jsonPath("$.message").value("validation failed"))
			.andExpect(jsonPath("$.errors.email").exists())
			.andExpect(jsonPath("$.errors.password").exists());
	}
}


