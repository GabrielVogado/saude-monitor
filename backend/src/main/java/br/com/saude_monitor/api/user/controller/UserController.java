package br.com.saude_monitor.api.user.controller;

import br.com.saude_monitor.api.user.dto.UserRequest;
import br.com.saude_monitor.api.user.dto.UserResponse;
import br.com.saude_monitor.api.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private static final Logger logger = LoggerFactory.getLogger(UserController.class);

    private final UserService userService;


    @PostMapping("/cadastro")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody UserRequest request) {
        logger.info("[UserController] Requisicao de cadastro de Usuario recebida do frontend para fullname={} email={}",
                request.fullName(), request.email());

        var response = userService.saveUser(request);

        logger.info("[UserController] Resposta de cadastro enviada com sucesso para email={}", request.email());
        return ResponseEntity.ok(response);
    }
}
