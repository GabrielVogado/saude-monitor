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

        var existing = authRepository.findByEmail(request.email());

        AuthDocument document;
        if (existing.isPresent()) {
            document = existing.get();
            document.setPassword(request.password());
            document.setRememberDevice(request.rememberDevice());
        } else {
            document = AuthDocument.builder()
                    .email(request.email())
                    .password(request.password())
                    .rememberDevice(request.rememberDevice())
                    .createdAt(Instant.now())
                    .build();
        }

        var result = authRepository.save(document);
        return new LoginResponse(
                true,
                "Login salvo com sucesso",
                result.getEmail(),
                result.isRememberDevice()
        );

    }
}
