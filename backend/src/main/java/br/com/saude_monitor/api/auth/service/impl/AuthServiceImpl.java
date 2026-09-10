package br.com.saude_monitor.api.auth.service.impl;

import br.com.saude_monitor.api.auth.dto.AuthResponse;
import br.com.saude_monitor.api.auth.dto.EsqueciSenhaRequest;
import br.com.saude_monitor.api.auth.dto.LoginRequest;
import br.com.saude_monitor.api.auth.dto.RedefinirSenhaRequest;
import br.com.saude_monitor.api.auth.dto.RefreshRequest;
import br.com.saude_monitor.api.auth.dto.UsuarioDto;
import br.com.saude_monitor.api.auth.email.EmailService;
import br.com.saude_monitor.api.auth.passwordreset.PasswordResetTokenDocument;
import br.com.saude_monitor.api.auth.passwordreset.PasswordResetTokenRepository;
import br.com.saude_monitor.api.auth.revogacao.RefreshTokenRevogadoDocument;
import br.com.saude_monitor.api.auth.revogacao.RefreshTokenRevogadoRepository;
import br.com.saude_monitor.api.auth.service.AuthService;
import br.com.saude_monitor.api.config.exception.NaoAutorizadoException;
import br.com.saude_monitor.api.config.security.JwtService;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.repository.UserRepository;
import br.com.saude_monitor.api.user.util.EmailNormalizer;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

/**
 * Implementação de autenticação (F0-01/F0-02).
 *
 * <p>Autentica credenciais contra o {@code senhaHash} (BCrypt) do usuário e emite
 * access (15 min) + refresh (30 dias) tokens JWT. O refresh rotaciona o par e o logout
 * revoga o refresh token em uma {@link RefreshTokenRevogadoDocument blacklist} (TTL).
 * Mensagens de erro são genéricas para não revelar se o e-mail existe.</p>
 */
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private static final Logger logger = LoggerFactory.getLogger(AuthServiceImpl.class);
    private static final String CREDENCIAIS_INVALIDAS = "E-mail ou senha inválidos.";
    private static final String REFRESH_INVALIDO = "Refresh token inválido ou expirado.";
    private static final String CODIGO_INVALIDO = "Código inválido ou expirado.";
    private static final int CODIGO_EXPIRACAO_MINUTOS = 15;
    private static final int CODIGO_MAX_TENTATIVAS = 5;
    /** Valor descartável só para gastar o mesmo tempo de BCrypt no ramo "e-mail não existe". */
    private static final String CODIGO_DUMMY_TEMPO_CONSTANTE = "000000";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenRevogadoRepository refreshTokenRevogadoRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailService emailService;
    private final MongoTemplate mongoTemplate;
    private final SecureRandom secureRandom = new SecureRandom();

    @Override
    public AuthResponse login(LoginRequest request) {
        UserDocument user = userRepository.findByEmail(normalizeEmail(request.email()))
                .filter(u -> u.getSenhaHash() != null)
                .filter(u -> passwordEncoder.matches(request.password(), u.getSenhaHash()))
                .orElseThrow(() -> new NaoAutorizadoException(CREDENCIAIS_INVALIDAS));

        if (!user.isActive()) {
            throw new NaoAutorizadoException("Conta desativada.");
        }

        return emitirTokens(user);
    }

    @Override
    public AuthResponse refresh(RefreshRequest request) {
        String token = request.refreshToken();
        if (!jwtService.isRefreshTokenValid(token)) {
            throw new NaoAutorizadoException(REFRESH_INVALIDO);
        }

        // Blacklist (F0-02/§3.1): refresh revogado no logout não gera novo access token.
        if (refreshTokenRevogadoRepository.existsById(jwtService.extractJti(token))) {
            logger.warn("Tentativa de refresh com token revogado; bloqueado.");
            throw new NaoAutorizadoException(REFRESH_INVALIDO);
        }

        String email = jwtService.extractEmail(token);
        UserDocument user = userRepository.findByEmail(normalizeEmail(email))
                .filter(UserDocument::isActive)
                .orElseThrow(() -> new NaoAutorizadoException("Usuário não encontrado ou inativo."));

        // Achado de 10/09/2026: um refresh token emitido antes de uma redefinição de
        // senha ("esqueci minha senha") continuaria renovando por até 30 dias — a troca
        // de senha precisa encerrar as sessões que já existiam antes dela.
        //
        // `senhaAlteradaEm` é truncado para o segundo antes da comparação porque o claim
        // `iat` do JWT (RFC 7519 NumericDate) só tem precisão de segundo — sem o
        // truncamento, um token emitido no MESMO segundo do reset (ex.: reset às
        // 10:00:00.900, login logo em seguida às 10:00:00.950 → `iat` serializado como
        // 10:00:00) era comparado contra um instante com milissegundos e considerado
        // "anterior ao reset" por engano, derrubando uma sessão legítima recém-criada
        // (achado do code-review). O resíduo — um token emitido de fato antes do reset
        // mas no mesmo segundo continuar aceito por até 1s — é um risco desprezível
        // perto do bug de falso-negativo que isto substitui.
        if (user.getSenhaAlteradaEm() != null
                && jwtService.extractIssuedAt(token).isBefore(user.getSenhaAlteradaEm().truncatedTo(ChronoUnit.SECONDS))) {
            throw new NaoAutorizadoException(REFRESH_INVALIDO);
        }

        // Rotação: revoga o refresh anterior (especificação §3.1) e emite novo par.
        revogar(token);
        return emitirTokens(user);
    }

    @Override
    public Map<String, Object> esqueciSenha(EsqueciSenhaRequest request) {
        String email = normalizeEmail(request.email());
        boolean existe = userRepository.findByEmail(email).filter(UserDocument::isActive).isPresent();

        if (existe) {
            gerarEEnviarCodigo(email);
        } else {
            // Achado do code-review (10/09/2026): sem isto, o ramo "e-mail existe" fazia
            // um hash BCrypt (~60-100ms) e uma gravação no Mongo que o ramo "não existe"
            // não fazia — mesmo com o corpo da resposta idêntico, a diferença de latência
            // era um canal lateral que um atacante consegue medir para descobrir e-mails
            // cadastrados. Gasta o mesmo tempo de BCrypt aqui, sobre um valor descartável.
            passwordEncoder.encode(CODIGO_DUMMY_TEMPO_CONSTANTE);
        }

        // Resposta sempre genérica: exista ou não o e-mail, e mesmo que o envio falhe
        // (EmailService nunca propaga — ver contrato), o cliente não recebe sinal
        // diferente que permita descobrir e-mails cadastrados.
        return Map.of(
                "success", true,
                "message", "Se o e-mail existir, você receberá um código de redefinição."
        );
    }

    @Override
    public Map<String, Object> redefinirSenha(RedefinirSenhaRequest request) {
        String email = normalizeEmail(request.email());

        PasswordResetTokenDocument tokenDoc = passwordResetTokenRepository.findByEmail(email)
                .filter(t -> t.getExpiraEm().isAfter(Instant.now()))
                .orElseThrow(() -> new NaoAutorizadoException(CODIGO_INVALIDO));

        if (!passwordEncoder.matches(request.codigo(), tokenDoc.getCodigoHash())) {
            registrarTentativaFalha(email);
            throw new NaoAutorizadoException(CODIGO_INVALIDO);
        }

        UserDocument user = userRepository.findByEmail(email)
                .filter(UserDocument::isActive)
                .orElseThrow(() -> new NaoAutorizadoException(CODIGO_INVALIDO));

        user.setSenhaHash(passwordEncoder.encode(request.novaSenha()));
        user.setSenhaAlteradaEm(Instant.now());
        userRepository.save(user);

        passwordResetTokenRepository.deleteByEmail(email);
        logger.info("Senha redefinida via código (esqueci minha senha) para email={}", email);

        return Map.of(
                "success", true,
                "message", "Senha redefinida com sucesso."
        );
    }

    /**
     * Gera o código e faz upsert atômico por e-mail (via {@link MongoTemplate}, não
     * find-then-save): achado do code-review (10/09/2026) — o `esqueciSenha` do frontend
     * é marcado `idempotente: true` e `fetchComRetry` o repete em 502/503/504 (cold
     * start), então duas requisições quase simultâneas para o mesmo e-mail eram um
     * cenário real, não hipotético. Um find-then-save comum corria: as duas liam
     * "nenhum token" e as duas tentavam inserir, a segunda estourava
     * {@code DuplicateKeyException} (índice único em {@code email}) sem captura, virando
     * um 500 em vez da resposta genérica sempre-200. O upsert do Mongo resolve a corrida
     * no próprio banco — não há mais dois inserts concorrentes para capturar.
     */
    private void gerarEEnviarCodigo(String email) {
        String codigo = "%06d".formatted(secureRandom.nextInt(1_000_000));
        Instant agora = Instant.now();

        Query query = Query.query(Criteria.where("email").is(email));
        Update update = new Update()
                .set("email", email)
                .set("codigoHash", passwordEncoder.encode(codigo))
                .set("tentativas", 0)
                .set("criadoEm", agora)
                .set("expiraEm", agora.plus(CODIGO_EXPIRACAO_MINUTOS, ChronoUnit.MINUTES));
        mongoTemplate.upsert(query, update, PasswordResetTokenDocument.class);
        emailService.enviarCodigoRedefinicaoSenha(email, codigo);
    }

    /**
     * Incrementa {@code tentativas} atomicamente (via {@code $inc}, não read-modify-write):
     * achado do code-review (10/09/2026) — duas tentativas de código erradas em paralelo
     * (dentro do orçamento de 10 req/min/IP do rate limit) podiam ler o mesmo valor de
     * {@code tentativas}, cada uma somar 1 e sobrescrever a outra, perdendo um incremento
     * e deixando o atacante ultrapassar as 5 tentativas pretendidas. Estourou o limite: o
     * token é descartado — o usuário precisa pedir um novo código.
     */
    private void registrarTentativaFalha(String email) {
        Query query = Query.query(Criteria.where("email").is(email));
        Update update = new Update().inc("tentativas", 1);
        PasswordResetTokenDocument atualizado = mongoTemplate.findAndModify(
                query, update, FindAndModifyOptions.options().returnNew(true), PasswordResetTokenDocument.class);

        if (atualizado != null && atualizado.getTentativas() >= CODIGO_MAX_TENTATIVAS) {
            passwordResetTokenRepository.deleteByEmail(email);
        }
    }

    @Override
    public Map<String, Object> logout(RefreshRequest request) {
        String token = request.refreshToken();

        if (jwtService.isRefreshTokenValid(token)) {
            revogar(token);
            logger.info("Sessão encerrada (logout): refresh token revogado.");
        }
        // Idempotente: token já expirado/malformado não tem o que revogar; resposta é a mesma.

        return Map.of(
                "success", true,
                "message", "Sessão encerrada. Refresh token revogado."
        );
    }

    /** Insere o token na blacklist com TTL replicando a própria expiração do refresh. */
    private void revogar(String token) {
        try {
            refreshTokenRevogadoRepository.insert(RefreshTokenRevogadoDocument.builder()
                    .id(jwtService.extractJti(token))
                    .email(jwtService.extractEmail(token))
                    .revogadoEm(Instant.now())
                    .expiraEm(jwtService.extractExpiration(token))
                    .build());
        } catch (DuplicateKeyException ex) {
            // Registro duplicado (idêntico ao jti, ex.: logout repetido) é esperado e inofensivo.
            // Qualquer outra falha (ex.: Mongo indisponível) propaga — logout não pode
            // devolver "sessão encerrada" quando a revogação não foi persistida de fato.
            logger.debug("Revogação já registrada para o jti: {}", ex.getMessage());
        }
    }

    private AuthResponse emitirTokens(UserDocument user) {
        return new AuthResponse(
                jwtService.generateAccessToken(user),
                jwtService.generateRefreshToken(user),
                jwtService.accessExpirationSeconds(),
                toUsuarioDto(user)
        );
    }

    private UsuarioDto toUsuarioDto(UserDocument user) {
        return new UsuarioDto(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPapel() == null ? "USER" : user.getPapel().name()
        );
    }

    private String normalizeEmail(String email) {
        String normalizado = EmailNormalizer.normalizar(email);
        return normalizado == null ? "" : normalizado;
    }
}
