package br.com.saude_monitor.api.user.service.impl;

import br.com.saude_monitor.api.agregado.service.AgregadoService;
import br.com.saude_monitor.api.auth.repository.AuthRepository;
import br.com.saude_monitor.api.config.exception.RecursoNaoEncontradoException;
import br.com.saude_monitor.api.config.exception.ValidacaoNegocioException;
import br.com.saude_monitor.api.feedback.document.FeedbackDocument;
import br.com.saude_monitor.api.user.document.ConsentimentoItem;
import br.com.saude_monitor.api.user.document.ConsentimentosDocument;
import br.com.saude_monitor.api.user.document.Papel;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.dto.AtualizarConsentimentosRequest;
import br.com.saude_monitor.api.user.dto.ConsentimentoRequest;
import br.com.saude_monitor.api.user.dto.ConsentimentosResponse;
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
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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

        ConsentimentoRequest consent = request.consentimento();
        if (consent == null || !consent.termosUso()) {
            throw new ValidacaoNegocioException("Aceite dos termos de uso é obrigatório para criar a conta.");
        }

        var user = userRepository.save(UserDocument.builder()
                .fullName(request.fullName())
                .email(normalizedEmail)
                .phone(request.phone())
                .senhaHash(passwordEncoder.encode(request.password()))
                .papel(Papel.USER)
                .consentimentos(consentimentosRegistrados(consent, now))
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
    public ConsentimentosResponse atualizarConsentimentos(String usuarioId, AtualizarConsentimentosRequest request) {
        if (request == null || request.vazio()) {
            throw new ValidacaoNegocioException(
                    "Informe ao menos uma finalidade (localizacao ou notificacoes) para atualizar.");
        }

        UserDocument user = userRepository.findById(usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado."));

        ConsentimentosDocument consentimentos = user.getConsentimentos() == null
                ? ConsentimentosDocument.builder().build()
                : user.getConsentimentos();

        Instant now = Instant.now();
        if (request.localizacao() != null) {
            consentimentos.setLocalizacao(
                    decidir(consentimentos.getLocalizacao(), request.localizacao(), request.versaoTermos(), now));
        }
        if (request.notificacoes() != null) {
            consentimentos.setNotificacoes(
                    decidir(consentimentos.getNotificacoes(), request.notificacoes(), request.versaoTermos(), now));
        }

        user.setConsentimentos(consentimentos);
        user.setUpdatedAt(now);
        userRepository.save(user);

        // Trilha de auditoria da decisão (art. 8º §5º): registra o que mudou, sem
        // qualquer dado pessoal além do identificador interno.
        log.info("Consentimentos do usuário {} atualizados (LGPD): localizacao={}, notificacoes={}.",
                usuarioId, request.localizacao(), request.notificacoes());

        return ConsentimentosResponse.de(consentimentos);
    }

    /**
     * Monta o registro da decisão. A versão do aviso é mantida quando o app não a
     * informa — não podemos "apagar" a versão sob a qual o aceite original foi dado.
     */
    private ConsentimentoItem decidir(ConsentimentoItem atual, boolean aceito, String versao, Instant now) {
        String versaoRegistrada = versao == null || versao.isBlank()
                ? (atual == null ? null : atual.getVersao())
                : versao;
        return ConsentimentoItem.builder()
                .aceito(aceito)
                .data(now)
                .versao(versaoRegistrada)
                .build();
    }

    @Override
    public Map<String, Object> exportarDados(String usuarioId) {
        UserDocument user = userRepository.findById(usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado."));

        Query query = Query.query(Criteria.where("usuarioId").is(user.getId()));
        List<VisitaDocument> visitas = mongoTemplate.find(query, VisitaDocument.class);
        List<FeedbackDocument> feedbacks = mongoTemplate.find(query, FeedbackDocument.class);

        Map<String, Object> dados = new LinkedHashMap<>();
        dados.put("geradoEm", Instant.now());
        dados.put("usuario", Map.of(
                "nome", user.getFullName(),
                "email", user.getEmail(),
                "telefone", user.getPhone() == null ? "" : user.getPhone(),
                "criadoEm", user.getCreatedAt(),
                "consentimentos", user.getConsentimentos()
        ));
        dados.put("visitas", visitas);
        dados.put("feedbacks", feedbacks);
        return dados;
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
     * Registra os consentimentos LGPD do titular no cadastro. O aceite dos termos de uso
     * é obrigatório e vem explícito no payload (§3.1 — {@code consentimento.termosUso});
     * localização e notificações ficam pendentes até o usuário optar explicitamente.
     */
    private ConsentimentosDocument consentimentosRegistrados(ConsentimentoRequest consent, Instant now) {
        String versao = consent.versaoTermos() == null || consent.versaoTermos().isBlank()
                ? VERSAO_TERMOS
                : consent.versaoTermos();
        return ConsentimentosDocument.builder()
                .termosUso(ConsentimentoItem.builder().aceito(true).data(now).versao(versao).build())
                .localizacao(ConsentimentoItem.builder().aceito(false).data(null).versao(null).build())
                .notificacoes(ConsentimentoItem.builder().aceito(false).data(null).versao(null).build())
                .build();
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
