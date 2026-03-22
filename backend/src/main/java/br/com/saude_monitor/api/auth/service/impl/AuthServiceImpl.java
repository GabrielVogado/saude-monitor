package br.com.saude_monitor.api.auth.service.impl;

import br.com.saude_monitor.api.auth.document.AuthDocument;
import br.com.saude_monitor.api.auth.dto.LoginRequest;
import br.com.saude_monitor.api.auth.dto.LoginResponse;
import br.com.saude_monitor.api.auth.repository.AuthRepository;
import br.com.saude_monitor.api.auth.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final AuthRepository authRepository;

    @Override
    public LoginResponse saveLogin(LoginRequest request) {

        var rq  = AuthDocument.builder()
                .email(request.email())
                .password(request.password())
                .rememberDevice(request.rememberDevice())
                .createdAt(Instant.now())
                .build();

        var result = authRepository.save(rq);
        return new LoginResponse(
                true,
                "Login salvo com sucesso",
                result.getEmail(),
                result.isRememberDevice()
        );

    }
}
