package br.com.saude_monitor.api.user.service.impl;

import br.com.saude_monitor.api.user.document.ConsentimentoItem;
import br.com.saude_monitor.api.user.document.ConsentimentosDocument;
import br.com.saude_monitor.api.user.document.Papel;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.dto.UserRequest;
import br.com.saude_monitor.api.user.dto.UserResponse;
import br.com.saude_monitor.api.user.repository.UserRepository;
import br.com.saude_monitor.api.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Locale;

/**
 * Implementação do cadastro de usuários (F0-01).
 *
 * <p>A senha é armazenada <strong>apenas</strong> como hash BCrypt ({@code senhaHash}),
 * nunca em texto puro. O papel padrão é {@code USER} e os consentimentos LGPD são
 * registrados com aceite dos termos de uso (obrigatório).</p>
 */
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private static final String VERSAO_TERMOS = "1.0";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public UserResponse saveUser(UserRequest request) {
        var now = Instant.now();
        var normalizedEmail = normalizeEmail(request.email());

        if (userRepository.findByEmail(normalizedEmail).isPresent()) {
            return new UserResponse(
                    false,
                    "Email já cadastrado",
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
                .senhaHash(passwordEncoder.encode(request.password()))
                .papel(Papel.USER)
                .consentimentos(consentimentosIniciais(now))
                .active(true)
                .createdAt(now)
                .updatedAt(now)
                .build());

        return new UserResponse(
                true,
                "Usuário cadastrado com sucesso",
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.isActive(),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }

    /**
     * Registra os consentimentos iniciais. O aceite dos termos de uso é obrigatório
     * (LGPD) e, no MVP, é concedido implicitamente pelo fluxo de cadastro; localização
     * e notificações ficam pendentes até o usuário optar explicitamente.
     */
    private ConsentimentosDocument consentimentosIniciais(Instant now) {
        return ConsentimentosDocument.builder()
                .termosUso(ConsentimentoItem.builder().aceito(true).data(now).versao(VERSAO_TERMOS).build())
                .localizacao(ConsentimentoItem.builder().aceito(false).data(null).versao(null).build())
                .notificacoes(ConsentimentoItem.builder().aceito(false).data(null).versao(null).build())
                .build();
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
