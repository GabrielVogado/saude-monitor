package br.com.saude_monitor.api.auth.service.impl;

import br.com.saude_monitor.api.auth.dto.AuthResponse;
import br.com.saude_monitor.api.auth.dto.ConfirmarEmailRequest;
import br.com.saude_monitor.api.auth.dto.EsqueciSenhaRequest;
import br.com.saude_monitor.api.auth.dto.LoginRequest;
import br.com.saude_monitor.api.auth.dto.RedefinirSenhaRequest;
import br.com.saude_monitor.api.auth.dto.ReenviarConfirmacaoRequest;
import br.com.saude_monitor.api.auth.dto.RefreshRequest;
import br.com.saude_monitor.api.auth.email.EmailService;
import br.com.saude_monitor.api.auth.verificacao.CodigoVerificacaoDocument;
import br.com.saude_monitor.api.auth.verificacao.CodigoVerificacaoRepository;
import br.com.saude_monitor.api.auth.verificacao.Proposito;
import br.com.saude_monitor.api.auth.revogacao.RefreshTokenRevogadoDocument;
import br.com.saude_monitor.api.auth.revogacao.RefreshTokenRevogadoRepository;
import br.com.saude_monitor.api.config.exception.EmailNaoConfirmadoException;
import br.com.saude_monitor.api.config.exception.NaoAutorizadoException;
import br.com.saude_monitor.api.config.security.JwtProperties;
import br.com.saude_monitor.api.config.security.JwtService;
import br.com.saude_monitor.api.user.document.Papel;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.user.repository.UserRepository;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.matches;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Testes unitários do {@link AuthServiceImpl} (F0-01/F0-02) — login, refresh (com rotação
 * e blacklist) e logout (revogação do refresh token).
 */
class AuthServiceImplTest {

    private AuthServiceImpl authService;
    private UserRepository userRepository;
    private JwtService jwtService;
    private RefreshTokenRevogadoRepository revogadoRepository;
    private CodigoVerificacaoRepository codigoVerificacaoRepository;
    private EmailService emailService;
    private PasswordEncoder passwordEncoder;
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void setup() {
        userRepository = mock(UserRepository.class);
        revogadoRepository = mock(RefreshTokenRevogadoRepository.class);
        codigoVerificacaoRepository = mock(CodigoVerificacaoRepository.class);
        emailService = mock(EmailService.class);
        mongoTemplate = mock(MongoTemplate.class);
        passwordEncoder = new BCryptPasswordEncoder();

        JwtProperties properties = new JwtProperties(
                "teste-secret-key-com-mais-de-32-bytes-para-hs256",
                900_000L,
                2_592_000_000L
        );
        jwtService = new JwtService(properties);

        authService = new AuthServiceImpl(
                userRepository, passwordEncoder, jwtService, revogadoRepository,
                codigoVerificacaoRepository, emailService, mongoTemplate);
    }

    /** "Ativo" aqui inclui e-mail confirmado — a maioria dos testes não exercita esse eixo. */
    private UserDocument usuarioAtivo(String email) {
        return UserDocument.builder()
                .id("1")
                .fullName("Marina Souza")
                .email(email)
                .senhaHash("hash")
                .papel(Papel.USER)
                .active(true)
                .emailVerificado(true)
                .build();
    }

    @Test
    void deveAutenticarCredenciaisValidas() {
        String senhaHash = new BCryptPasswordEncoder().encode("S3nh@Forte!");
        UserDocument user = UserDocument.builder()
                .id("1")
                .fullName("Marina Souza")
                .email("marina@email.com")
                .senhaHash(senhaHash)
                .papel(Papel.USER)
                .active(true)
                .emailVerificado(true)
                .build();

        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));

        AuthResponse response = authService.login(new LoginRequest("marina@email.com", "S3nh@Forte!", false));

        assertNotNull(response.accessToken());
        assertNotNull(response.refreshToken());
        assertEquals(900, response.expiraEm());
        assertEquals("marina@email.com", response.usuario().email());
        assertEquals("USER", response.usuario().papel());
    }

    @Test
    void deveRejeitarLoginComEmailNaoConfirmado() {
        // Achado do PO (10/09/2026): sem confirmar o e-mail no cadastro, um endereço com
        // erro de digitação ou inexistente nunca recebe o código de "esqueci minha senha".
        String senhaHash = new BCryptPasswordEncoder().encode("S3nh@Forte!");
        UserDocument user = UserDocument.builder()
                .id("1")
                .email("marina@email.com")
                .senhaHash(senhaHash)
                .papel(Papel.USER)
                .active(true)
                .emailVerificado(false)
                .build();
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));

        EmailNaoConfirmadoException ex = assertThrows(EmailNaoConfirmadoException.class,
                () -> authService.login(new LoginRequest("marina@email.com", "S3nh@Forte!", false)));

        assertEquals("EMAIL_NAO_CONFIRMADO", ex.getCode());
    }

    @Test
    void deveRejeitarSenhaIncorreta() {
        UserDocument user = UserDocument.builder()
                .id("1")
                .email("marina@email.com")
                .senhaHash(new BCryptPasswordEncoder().encode("outra-senha"))
                .papel(Papel.USER)
                .active(true)
                .build();

        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));

        assertThrows(NaoAutorizadoException.class,
                () -> authService.login(new LoginRequest("marina@email.com", "senha-errada", false)));
    }

    @Test
    void deveRejeitarUsuarioInexistente() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());

        assertThrows(NaoAutorizadoException.class,
                () -> authService.login(new LoginRequest("nao@existe.com", "qualquer", false)));
    }

    @Test
    void deveRenovarTokensComRefreshValido() {
        UserDocument user = usuarioAtivo("marina@email.com");
        String refreshToken = jwtService.generateRefreshToken(user);
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));

        AuthResponse response = authService.refresh(new RefreshRequest(refreshToken));

        assertNotNull(response.accessToken());
        assertNotNull(response.refreshToken());
    }

    @Test
    void deveRejeitarRefreshInvalido() {
        assertThrows(NaoAutorizadoException.class,
                () -> authService.refresh(new RefreshRequest("token-invalido")));
    }

    // ------------------------------------------------ Logout / blacklist (F0-02 §3.1) -------------------------------

    @Test
    void deveRevogarRefreshTokenNoLogout() {
        UserDocument user = usuarioAtivo("marina@email.com");
        String refreshToken = jwtService.generateRefreshToken(user);
        String jti = jwtService.extractJti(refreshToken);

        Map<String, Object> resposta = authService.logout(new RefreshRequest(refreshToken));

        assertTrue((Boolean) resposta.get("success"));
        // o refresh token apresentado entra na blacklist com TTL da própria expiração
        verify(revogadoRepository).insert(argThat((RefreshTokenRevogadoDocument doc) ->
                jti.equals(doc.getId())
                        && "marina@email.com".equals(doc.getEmail())
                        && doc.getExpiraEm() != null));
    }

    @Test
    void deveRejeitarRefreshDeTokenRevogado() {
        UserDocument user = usuarioAtivo("marina@email.com");
        String refreshToken = jwtService.generateRefreshToken(user);
        String jti = jwtService.extractJti(refreshToken);
        when(revogadoRepository.existsById(jti)).thenReturn(true);
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));

        NaoAutorizadoException ex = assertThrows(NaoAutorizadoException.class,
                () -> authService.refresh(new RefreshRequest(refreshToken)));

        assertEquals("Refresh token inválido ou expirado.", ex.getMessage());
        // token revogado não reemitido
        verify(revogadoRepository, never()).insert(any(RefreshTokenRevogadoDocument.class));
    }

    @Test
    void deveSerIdempotenteNoLogout() {
        // token malformado/expirado: nada a revogar, mas a resposta continua 200-like (success)
        Map<String, Object> resposta = authService.logout(new RefreshRequest("token-invalido"));

        assertTrue((Boolean) resposta.get("success"));
        verify(revogadoRepository, never()).insert(any(RefreshTokenRevogadoDocument.class));
    }

    @Test
    void logoutRepetidoComChaveDuplicadaContinuaRespondendoSucesso() {
        // Segundo logout com o mesmo refresh token: jti já está na blacklist, o insert
        // falha por chave duplicada — esperado e inofensivo, resposta continua 200-like.
        UserDocument user = usuarioAtivo("marina@email.com");
        String refreshToken = jwtService.generateRefreshToken(user);
        when(revogadoRepository.insert(any(RefreshTokenRevogadoDocument.class)))
                .thenThrow(new DuplicateKeyException("E11000 duplicate key"));

        Map<String, Object> resposta = authService.logout(new RefreshRequest(refreshToken));

        assertTrue((Boolean) resposta.get("success"));
    }

    @Test
    void logoutNaoMascaraFalhaRealDePersistenciaComoSucesso() {
        // Achado da auditoria de erros silenciosos (08/09/2026): antes, qualquer
        // RuntimeException na revogação (não só chave duplicada) era engolida e o logout
        // sempre respondia "sessão encerrada" — mesmo quando o refresh token continuava
        // válido por não ter sido revogado de fato (ex.: falha de conexão com o Mongo).
        UserDocument user = usuarioAtivo("marina@email.com");
        String refreshToken = jwtService.generateRefreshToken(user);
        when(revogadoRepository.insert(any(RefreshTokenRevogadoDocument.class)))
                .thenThrow(new RuntimeException("Mongo indisponível"));

        assertThrows(RuntimeException.class,
                () -> authService.logout(new RefreshRequest(refreshToken)));
    }

    // ------------------------------------------------ Esqueci minha senha ------------------------------------------

    @Test
    void esqueciSenhaGeraEEnviaCodigoQuandoEmailExiste() {
        UserDocument user = usuarioAtivo("marina@email.com");
        when(userRepository.findByEmail("marina@email.com")).thenReturn(Optional.of(user));

        Map<String, Object> resposta = authService.esqueciSenha(new EsqueciSenhaRequest("marina@email.com"));

        assertTrue((Boolean) resposta.get("success"));
        // Upsert atômico (achado do code-review: find-then-save corria com o retry
        // idempotente do frontend e estourava DuplicateKeyException sem captura).
        verify(mongoTemplate).upsert(any(Query.class), any(Update.class), eq(CodigoVerificacaoDocument.class));
        verify(emailService).enviarCodigoRedefinicaoSenha(eq("marina@email.com"), matches("\\d{6}"));
    }

    @Test
    void esqueciSenhaSempreZeraTentativasEGeraNovoHashNoUpsert() {
        // O upsert nunca lê o token anterior: tentativas sempre volta a 0 e o hash é
        // sempre recalculado — nunca há mais de um código ativo por e-mail (decisão 3
        // do plano), nem um contador de tentativas herdado de um código velho.
        UserDocument user = usuarioAtivo("marina@email.com");
        when(userRepository.findByEmail("marina@email.com")).thenReturn(Optional.of(user));

        authService.esqueciSenha(new EsqueciSenhaRequest("marina@email.com"));

        ArgumentCaptor<Update> updateCaptor = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).upsert(any(Query.class), updateCaptor.capture(), eq(CodigoVerificacaoDocument.class));
        Document setDoc = (Document) updateCaptor.getValue().getUpdateObject().get("$set");
        assertEquals(0, setDoc.getInteger("tentativas"));
        assertTrue(setDoc.getString("codigoHash") != null && !setDoc.getString("codigoHash").isBlank());
    }

    @Test
    void esqueciSenhaNaoEnviaEmailQuandoEmailNaoExisteMasRespostaEIgual() {
        when(userRepository.findByEmail("fantasma@email.com")).thenReturn(Optional.empty());

        Map<String, Object> resposta = authService.esqueciSenha(new EsqueciSenhaRequest("fantasma@email.com"));

        assertTrue((Boolean) resposta.get("success"));
        verify(emailService, never()).enviarCodigoRedefinicaoSenha(anyString(), anyString());
        verify(mongoTemplate, never()).upsert(any(), any(), eq(CodigoVerificacaoDocument.class));
    }

    @Test
    void esqueciSenhaGastaOMesmoTempoDeBcryptQuandoOEmailNaoExiste() {
        // Achado do code-review (10/09/2026): sem este encode "descartável", o ramo
        // "e-mail não existe" respondia bem mais rápido que o ramo "existe" (que faz
        // BCrypt + upsert + envio) — uma diferença de tempo medível que um atacante usa
        // para descobrir e-mails cadastrados, mesmo com o corpo da resposta idêntico.
        //
        // `PasswordEncoder` mockado só nesta instância (não o `BCryptPasswordEncoder`
        // real do restante da suíte): a classe do Spring Security tem métodos efetivamente
        // finais, que o `spy()` do Mockito não consegue interceptar (a tentativa deixava
        // um estado de "stubbing em aberto" que quebrava os testes seguintes).
        PasswordEncoder encoderMockado = mock(PasswordEncoder.class);
        AuthServiceImpl service = new AuthServiceImpl(
                userRepository, encoderMockado, jwtService, revogadoRepository,
                codigoVerificacaoRepository, emailService, mongoTemplate);
        when(userRepository.findByEmail("fantasma@email.com")).thenReturn(Optional.empty());

        service.esqueciSenha(new EsqueciSenhaRequest("fantasma@email.com"));

        verify(encoderMockado).encode(anyString());
    }

    // ------------------------------------------------ Redefinir senha ----------------------------------------------

    private CodigoVerificacaoDocument tokenValido(String email, String codigo, Proposito proposito) {
        return CodigoVerificacaoDocument.builder()
                .id("token-1")
                .email(email)
                .proposito(proposito)
                .codigoHash(passwordEncoder.encode(codigo))
                .tentativas(0)
                .criadoEm(Instant.now())
                .expiraEm(Instant.now().plus(15, ChronoUnit.MINUTES))
                .build();
    }

    @Test
    void redefinirSenhaComCodigoCertoTrocaASenhaEConsomeOToken() {
        UserDocument user = usuarioAtivo("marina@email.com");
        when(codigoVerificacaoRepository.findByEmailAndProposito("marina@email.com", Proposito.REDEFINIR_SENHA))
                .thenReturn(Optional.of(tokenValido("marina@email.com", "123456", Proposito.REDEFINIR_SENHA)));
        when(userRepository.findByEmail("marina@email.com")).thenReturn(Optional.of(user));

        Map<String, Object> resposta = authService.redefinirSenha(
                new RedefinirSenhaRequest("marina@email.com", "123456", "N0vaSenha!"));

        assertTrue((Boolean) resposta.get("success"));
        verify(userRepository).save(argThat((UserDocument u) ->
                passwordEncoder.matches("N0vaSenha!", u.getSenhaHash())
                        && u.getSenhaAlteradaEm() != null));
        verify(codigoVerificacaoRepository).deleteByEmailAndProposito("marina@email.com", Proposito.REDEFINIR_SENHA);
    }

    @Test
    void redefinirSenhaComCodigoErradoIncrementaTentativasAtomicamenteENaoTrocaSenha() {
        // Achado do code-review: um read-modify-write comum (ler tentativas, somar 1,
        // salvar) corre quando duas tentativas erradas chegam em paralelo — as duas leem
        // o mesmo valor, e um incremento se perde. `findAndModify` com `$inc` resolve a
        // soma no próprio Mongo, sem essa janela.
        when(codigoVerificacaoRepository.findByEmailAndProposito("marina@email.com", Proposito.REDEFINIR_SENHA))
                .thenReturn(Optional.of(tokenValido("marina@email.com", "123456", Proposito.REDEFINIR_SENHA)));
        CodigoVerificacaoDocument depoisDoIncremento = tokenValido("marina@email.com", "123456", Proposito.REDEFINIR_SENHA);
        depoisDoIncremento.setTentativas(1);
        when(mongoTemplate.findAndModify(
                any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(CodigoVerificacaoDocument.class)))
                .thenReturn(depoisDoIncremento);

        assertThrows(NaoAutorizadoException.class, () -> authService.redefinirSenha(
                new RedefinirSenhaRequest("marina@email.com", "000000", "N0vaSenha!")));

        verify(mongoTemplate).findAndModify(
                any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(CodigoVerificacaoDocument.class));
        verify(codigoVerificacaoRepository, never()).deleteByEmailAndProposito(anyString(), any(Proposito.class));
        verify(userRepository, never()).save(any(UserDocument.class));
    }

    @Test
    void redefinirSenhaDescartaOTokenAoEsgotarAsTentativas() {
        CodigoVerificacaoDocument quaseNoLimite = tokenValido("marina@email.com", "123456", Proposito.REDEFINIR_SENHA);
        quaseNoLimite.setTentativas(4);
        when(codigoVerificacaoRepository.findByEmailAndProposito("marina@email.com", Proposito.REDEFINIR_SENHA))
                .thenReturn(Optional.of(quaseNoLimite));
        CodigoVerificacaoDocument depoisDoIncremento = tokenValido("marina@email.com", "123456", Proposito.REDEFINIR_SENHA);
        depoisDoIncremento.setTentativas(5);
        when(mongoTemplate.findAndModify(
                any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(CodigoVerificacaoDocument.class)))
                .thenReturn(depoisDoIncremento);

        assertThrows(NaoAutorizadoException.class, () -> authService.redefinirSenha(
                new RedefinirSenhaRequest("marina@email.com", "000000", "N0vaSenha!")));

        verify(codigoVerificacaoRepository).deleteByEmailAndProposito("marina@email.com", Proposito.REDEFINIR_SENHA);
        verify(codigoVerificacaoRepository, never()).save(any(CodigoVerificacaoDocument.class));
    }

    @Test
    void redefinirSenhaComCodigoErradoNaoQuebraSeOTokenSumiuEntreALeituraEOIncremento() {
        // Corrida rara: outra requisição apagou o token (ex.: esgotou tentativas em
        // paralelo) entre o findByEmail e o findAndModify desta chamada.
        when(codigoVerificacaoRepository.findByEmailAndProposito("marina@email.com", Proposito.REDEFINIR_SENHA))
                .thenReturn(Optional.of(tokenValido("marina@email.com", "123456", Proposito.REDEFINIR_SENHA)));
        when(mongoTemplate.findAndModify(
                any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(CodigoVerificacaoDocument.class)))
                .thenReturn(null);

        assertThrows(NaoAutorizadoException.class, () -> authService.redefinirSenha(
                new RedefinirSenhaRequest("marina@email.com", "000000", "N0vaSenha!")));

        verify(codigoVerificacaoRepository, never()).deleteByEmailAndProposito(anyString(), any(Proposito.class));
    }

    @Test
    void redefinirSenhaRejeitaTokenExpirado() {
        CodigoVerificacaoDocument expirado = tokenValido("marina@email.com", "123456", Proposito.REDEFINIR_SENHA);
        expirado.setExpiraEm(Instant.now().minus(1, ChronoUnit.MINUTES));
        when(codigoVerificacaoRepository.findByEmailAndProposito("marina@email.com", Proposito.REDEFINIR_SENHA))
                .thenReturn(Optional.of(expirado));

        assertThrows(NaoAutorizadoException.class, () -> authService.redefinirSenha(
                new RedefinirSenhaRequest("marina@email.com", "123456", "N0vaSenha!")));

        verify(userRepository, never()).save(any(UserDocument.class));
    }

    @Test
    void redefinirSenhaRejeitaQuandoNaoHaTokenParaOEmail() {
        when(codigoVerificacaoRepository.findByEmailAndProposito("marina@email.com", Proposito.REDEFINIR_SENHA))
                .thenReturn(Optional.empty());

        assertThrows(NaoAutorizadoException.class, () -> authService.redefinirSenha(
                new RedefinirSenhaRequest("marina@email.com", "123456", "N0vaSenha!")));
    }

    // ------------------------------------------------ Confirmação de e-mail no cadastro ----------------------------

    @Test
    void enviarCodigoConfirmacaoEmailGeraCodigoEEnvia() {
        authService.enviarCodigoConfirmacaoEmail("marina@email.com");

        verify(mongoTemplate).upsert(any(Query.class), any(Update.class), eq(CodigoVerificacaoDocument.class));
        verify(emailService).enviarCodigoConfirmacaoEmail(eq("marina@email.com"), matches("\\d{6}"));
        verify(emailService, never()).enviarCodigoRedefinicaoSenha(anyString(), anyString());
    }

    @Test
    void confirmarEmailComCodigoCertoMarcaVerificadoEConsomeOToken() {
        UserDocument user = UserDocument.builder()
                .id("1").email("marina@email.com").senhaHash("hash").papel(Papel.USER)
                .active(true).emailVerificado(false).build();
        when(codigoVerificacaoRepository.findByEmailAndProposito("marina@email.com", Proposito.CONFIRMAR_EMAIL))
                .thenReturn(Optional.of(tokenValido("marina@email.com", "123456", Proposito.CONFIRMAR_EMAIL)));
        when(userRepository.findByEmail("marina@email.com")).thenReturn(Optional.of(user));

        Map<String, Object> resposta = authService.confirmarEmail(
                new ConfirmarEmailRequest("marina@email.com", "123456"));

        assertTrue((Boolean) resposta.get("success"));
        verify(userRepository).save(argThat(UserDocument::isEmailVerificado));
        verify(codigoVerificacaoRepository).deleteByEmailAndProposito("marina@email.com", Proposito.CONFIRMAR_EMAIL);
    }

    @Test
    void confirmarEmailComCodigoErradoIncrementaTentativasENaoConfirma() {
        when(codigoVerificacaoRepository.findByEmailAndProposito("marina@email.com", Proposito.CONFIRMAR_EMAIL))
                .thenReturn(Optional.of(tokenValido("marina@email.com", "123456", Proposito.CONFIRMAR_EMAIL)));

        assertThrows(NaoAutorizadoException.class, () -> authService.confirmarEmail(
                new ConfirmarEmailRequest("marina@email.com", "000000")));

        verify(userRepository, never()).save(any(UserDocument.class));
    }

    @Test
    void reenviarConfirmacaoEnviaQuandoAindaNaoConfirmado() {
        UserDocument user = UserDocument.builder()
                .id("1").email("marina@email.com").senhaHash("hash").papel(Papel.USER)
                .active(true).emailVerificado(false).build();
        when(userRepository.findByEmail("marina@email.com")).thenReturn(Optional.of(user));

        Map<String, Object> resposta = authService.reenviarConfirmacaoEmail(
                new ReenviarConfirmacaoRequest("marina@email.com"));

        assertTrue((Boolean) resposta.get("success"));
        verify(emailService).enviarCodigoConfirmacaoEmail(eq("marina@email.com"), matches("\\d{6}"));
    }

    @Test
    void reenviarConfirmacaoNaoEnviaQuandoJaConfirmadoMasRespostaEIgual() {
        UserDocument user = usuarioAtivo("marina@email.com"); // emailVerificado=true
        when(userRepository.findByEmail("marina@email.com")).thenReturn(Optional.of(user));

        Map<String, Object> resposta = authService.reenviarConfirmacaoEmail(
                new ReenviarConfirmacaoRequest("marina@email.com"));

        assertTrue((Boolean) resposta.get("success"));
        verify(emailService, never()).enviarCodigoConfirmacaoEmail(anyString(), anyString());
    }

    @Test
    void reenviarConfirmacaoNaoEnviaQuandoEmailNaoExisteMasRespostaEIgual() {
        when(userRepository.findByEmail("fantasma@email.com")).thenReturn(Optional.empty());

        Map<String, Object> resposta = authService.reenviarConfirmacaoEmail(
                new ReenviarConfirmacaoRequest("fantasma@email.com"));

        assertTrue((Boolean) resposta.get("success"));
        verify(emailService, never()).enviarCodigoConfirmacaoEmail(anyString(), anyString());
    }

    // ------------------------------------------------ Refresh após reset (invalida sessão antiga) -------------------

    @Test
    void refreshEmitidoAntesDoResetDeSenhaEhRecusado() {
        UserDocument user = usuarioAtivo("marina@email.com");
        String refreshToken = jwtService.generateRefreshToken(user);

        // A senha é "alterada" DEPOIS de o token acima ter sido emitido.
        user.setSenhaAlteradaEm(Instant.now().plusSeconds(5));
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));

        NaoAutorizadoException ex = assertThrows(NaoAutorizadoException.class,
                () -> authService.refresh(new RefreshRequest(refreshToken)));

        assertEquals("Refresh token inválido ou expirado.", ex.getMessage());
        verify(revogadoRepository, never()).insert(any(RefreshTokenRevogadoDocument.class));
    }

    @Test
    void refreshEmitidoDepoisDoResetDeSenhaContinuaValido() {
        UserDocument user = usuarioAtivo("marina@email.com");
        // A senha foi alterada ANTES da emissão do token abaixo.
        user.setSenhaAlteradaEm(Instant.now().minusSeconds(5));
        String refreshToken = jwtService.generateRefreshToken(user);
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));

        AuthResponse response = authService.refresh(new RefreshRequest(refreshToken));

        assertNotNull(response.accessToken());
    }

    @Test
    void refreshEmitidoNoMesmoSegundoDoResetNaoEhFalsamenteRecusado() {
        // Achado do code-review: o claim `iat` do JWT só tem precisão de segundo (RFC
        // 7519 NumericDate); comparar direto contra `senhaAlteradaEm` (com milissegundos)
        // rejeitava um token emitido no MESMO segundo do reset, mesmo quando de fato
        // emitido DEPOIS dele — ex.: reset às 10:00:00.900, refresh gerado logo em
        // seguida às 10:00:00.950 (iat serializado como 10:00:00) caía como "anterior".
        UserDocument user = usuarioAtivo("marina@email.com");
        String refreshToken = jwtService.generateRefreshToken(user);
        Instant iatTruncado = jwtService.extractIssuedAt(refreshToken);
        user.setSenhaAlteradaEm(iatTruncado.plusMillis(400));
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));

        AuthResponse response = authService.refresh(new RefreshRequest(refreshToken));

        assertNotNull(response.accessToken());
    }

    @Test
    void refreshSemSenhaAlteradaEmNuncaERejeitadoPorEsseMotivo() {
        // Usuário que nunca usou "esqueci minha senha": senhaAlteradaEm é null, o refresh
        // segue o caminho de sempre.
        UserDocument user = usuarioAtivo("marina@email.com");
        assertNull(user.getSenhaAlteradaEm());
        String refreshToken = jwtService.generateRefreshToken(user);
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(user));

        AuthResponse response = authService.refresh(new RefreshRequest(refreshToken));

        assertNotNull(response.accessToken());
    }

    @Test
    void confirmarEmailRejeitaQuandoNaoHaCodigoValidoParaOEmail() {
        // Sem documento de código válido (nunca emitido, expirado ou já consumido): 401
        // genérico e nada de marcar o e-mail como verificado. O custo de BCrypt é
        // contabilizado neste ramo para não virar oráculo de tempo (achado do
        // security-review desta PR — ver M-013).
        when(codigoVerificacaoRepository.findByEmailAndProposito("marina@email.com", Proposito.CONFIRMAR_EMAIL))
                .thenReturn(Optional.empty());

        assertThrows(NaoAutorizadoException.class, () -> authService.confirmarEmail(
                new ConfirmarEmailRequest("marina@email.com", "123456")));

        verify(userRepository, never()).save(any(UserDocument.class));
    }
}
