package br.com.saude_monitor.api.user.service.impl;

import br.com.saude_monitor.api.auth.document.AuthDocument;
import br.com.saude_monitor.api.auth.repository.AuthRepository;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.dto.UserRequest;
import br.com.saude_monitor.api.user.dto.UserResponse;
import br.com.saude_monitor.api.user.repository.UserRepository;
import br.com.saude_monitor.api.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final AuthRepository authRepository;

    @Override
    public UserResponse saveUser(UserRequest request) {
        var now = Instant.now();
        var normalizedEmail = normalizeEmail(request.email());

        if (userRepository.findByEmail(normalizedEmail).isPresent() || authRepository.findByEmail(normalizedEmail).isPresent()) {
            return new UserResponse(
                    false,
                    "Email ja cadastrado",
                    null,
                    request.fullName(),
                    normalizedEmail,
                    request.phone(),
                    false,
                    null,
                    null
            );
        }

        var user = userRepository.save(UserDocument.builder()
                .fullName(request.fullName())
                .email(normalizedEmail)
                .phone(request.phone())
                .active(true)
                .createdAt(now)
                .updatedAt(now)
                .build());

        try {
            authRepository.save(AuthDocument.builder()
                    .user(user)
                    .email(normalizedEmail)
                    .password(request.password())
                    .rememberDevice(false)
                    .createdAt(now)
                    .build());
        } catch (RuntimeException ex) {
            userRepository.deleteById(user.getId());
            throw ex;
        }

        return new UserResponse(
                true,
                "Usuario cadastrado com sucesso",
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.isActive(),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
