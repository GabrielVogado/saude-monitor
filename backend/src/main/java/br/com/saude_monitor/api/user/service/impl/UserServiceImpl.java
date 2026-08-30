package br.com.saude_monitor.api.user.service.impl;

import br.com.saude_monitor.api.agregado.service.AgregadoService;
import br.com.saude_monitor.api.auth.repository.AuthRepository;
import br.com.saude_monitor.api.config.exception.RecursoNaoEncontradoException;
import br.com.saude_monitor.api.feedback.document.FeedbackDocument;
import br.com.saude_monitor.api.user.document.ConsentimentoItem;
import br.com.saude_monitor.api.user.document.ConsentimentosDocument;
import br.com.saude_monitor.api.user.document.Papel;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.dto.UserRequest;
import br.com.saude_monitor.api.user.dto.UserResponse;
import br.com.saude_monitor.api.user.repository.UserRepository;
import br.com.saude_monitor.api.user.service.UserService;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Implementação do cadastro de usuários (F0-01) e da exclusão de conta LGPD (F0-05).
 *
 * <p>A senha é armazenada <strong>apenas</strong> como hash BCrypt ({@code senhaHash}),
 * nunca em texto puro. O papel padrão é {@code USER} e os consentimentos LGPD são
 * registrados com aceite dos termos de uso (obrigatório).</p>
 *
 * <p>Na exclusão de conta (F0-05), os dados pessoais identificáveis são removidos
 * (documento de usuário + registros de autenticação) e os dados usados nas estatísticas
 * (visitas e feedbacks) são anonimizados — {@code usuarioId} zerado — preservando os
 * agregados públicos (nota/tempo), que nunca referenciam identidade.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private static final String VERSAO_TERMOS = "1.0";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthRepository authRepository;
    private final MongoTemplate mongoTemplate;
    private final AgregadoService agregadoService;

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

    @Override
    public void excluirConta(String usuarioId) {
        UserDocument user = userRepository.findById(usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado."));

        // Coleta os hospitais afetados ANTES de anonimizar, para recalcular os agregados
        // e refletir a exclusão imediatamente (os dados permanecem, então os valores não
        // mudam, mas o job de 15min não precisa esperar).
        Set<String> hospitalIds = hospitaisAfetados(usuarioId);

        // Anonimiza visitas e feedbacks (dados de estatística): desvincula o usuário.
        anonimizarVisitas(usuarioId);
        anonimizarFeedbacks(usuarioId);

        // Remove registros de autenticação (email + vínculo com o usuário).
        authRepository.deleteByUser_Id(usuarioId);

        // Remove o documento de usuário (dado pessoal identificável).
        userRepository.delete(user);

        log.info("Conta do usuário {} excluída (LGPD). Dados pessoais removidos; visitas/feedbacks anonimizados.",
                usuarioId);

        // Recalcula agregados dos hospitais afetados (best-effort).
        for (String hospitalId : hospitalIds) {
            try {
                agregadoService.recalcular(hospitalId);
            } catch (Exception ex) {
                log.warn("Falha ao recalcular agregado do hospital {} após exclusão de conta: {}",
                        hospitalId, ex.getMessage());
            }
        }
    }

    /** Hospitais atingidos por visitas/feedbacks do usuário (antes da anonimização). */
    private Set<String> hospitaisAfetados(String usuarioId) {
        Set<String> ids = new LinkedHashSet<>();
        Query query = Query.query(Criteria.where("usuarioId").is(usuarioId));
        query.fields().include("hospitalId");
        mongoTemplate.find(query, VisitaDocument.class)
                .forEach(v -> { if (v.getHospitalId() != null) ids.add(v.getHospitalId()); });
        mongoTemplate.find(query, FeedbackDocument.class)
                .forEach(f -> { if (f.getHospitalId() != null) ids.add(f.getHospitalId()); });
        return ids;
    }

    /** Desvincula o usuário das visitas (mantém a estatística de tempo). */
    private void anonimizarVisitas(String usuarioId) {
        Query query = Query.query(Criteria.where("usuarioId").is(usuarioId));
        Update update = new Update().set("usuarioId", null);
        mongoTemplate.updateMulti(query, update, VisitaDocument.class);
    }

    /** Desvincula o usuário dos feedbacks e marca como anonimizado (preserva a nota). */
    private void anonimizarFeedbacks(String usuarioId) {
        Query query = Query.query(Criteria.where("usuarioId").is(usuarioId));
        Update update = new Update().set("usuarioId", null).set("anonimizado", true);
        mongoTemplate.updateMulti(query, update, FeedbackDocument.class);
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
