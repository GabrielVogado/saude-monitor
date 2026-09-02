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
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Testes do serviço de usuários: cadastro com consentimento, exclusão de conta
 * LGPD (F0-05 — cascade de dados pessoais, anonimização de visitas/feedbacks e
 * recálculo de agregados) e gestão de consentimentos (E5-05 / art. 8º §5º).
 */
class UserServiceImplTest {

    private UserServiceImpl userService;
    private UserRepository userRepository;
    private AuthRepository authRepository;
    private MongoTemplate mongoTemplate;
    private AgregadoService agregadoService;

    @BeforeEach
    void setup() {
        userRepository = mock(UserRepository.class);
        authRepository = mock(AuthRepository.class);
        mongoTemplate = mock(MongoTemplate.class);
        agregadoService = mock(AgregadoService.class);

        userService = new UserServiceImpl(
                userRepository,
                new BCryptPasswordEncoder(),
                authRepository,
                mongoTemplate,
                agregadoService);
    }

    private UserDocument usuario(String id) {
        return UserDocument.builder()
                .id(id)
                .fullName("Marina Souza")
                .email("marina@email.com")
                .senhaHash("hash")
                .papel(Papel.USER)
                .active(true)
                .consentimentos(new ConsentimentosDocument())
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    @Test
    void deveLancarNaoEncontradoQuandoUsuarioInexistente() {
        when(userRepository.findById("x")).thenReturn(Optional.empty());

        assertThrows(RecursoNaoEncontradoException.class,
                () -> userService.excluirConta("x"));
        verify(userRepository, never()).delete(any(UserDocument.class));
    }

    @Test
    void deveExcluirUsuarioEAuthEAnonimizarVisitasEFeedbacks() {
        UserDocument user = usuario("u1");
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));
        when(mongoTemplate.find(any(Query.class), eq(VisitaDocument.class)))
                .thenReturn(List.of());
        when(mongoTemplate.find(any(Query.class), eq(FeedbackDocument.class)))
                .thenReturn(List.of());

        userService.excluirConta("u1");

        // Dados pessoais identificáveis removidos.
        verify(mongoTemplate).updateMulti(any(Query.class), any(),
                eq(VisitaDocument.class));
        verify(mongoTemplate).updateMulti(any(Query.class), any(),
                eq(FeedbackDocument.class));
        verify(authRepository).deleteByUser_Id("u1");
        verify(userRepository).delete(user);
    }

    @Test
    void deveRegistrarConsentimentoDeTermosNoCadastro() {
        when(userRepository.findByEmail("marina@email.com")).thenReturn(Optional.empty());
        when(userRepository.save(any(UserDocument.class))).thenAnswer(inv -> inv.getArgument(0));

        UserRequest request = new UserRequest("Marina Souza", "MARINA@email.com", "S3nh@Forte!",
                "(11) 99999-0000", new ConsentimentoRequest(true, "1.0"));

        UserResponse response = userService.saveUser(request);

        assertTrue(response.success());
        ArgumentCaptor<UserDocument> captor = ArgumentCaptor.forClass(UserDocument.class);
        verify(userRepository).save(captor.capture());
        ConsentimentoItem termos = captor.getValue().getConsentimentos().getTermosUso();
        assertTrue(termos.isAceito());
        assertEquals("1.0", termos.getVersao());
    }

    @Test
    void deveRejeitarCadastroSemAceiteDosTermos() {
        when(userRepository.findByEmail("marina@email.com")).thenReturn(Optional.empty());

        UserRequest request = new UserRequest("Marina Souza", "marina@email.com", "S3nh@Forte!",
                null, new ConsentimentoRequest(false, "1.0"));

        assertThrows(ValidacaoNegocioException.class, () -> userService.saveUser(request));
        verify(userRepository, never()).save(any(UserDocument.class));
    }

    @Test
    void deveExportarDadosPessoaisDoUsuario() {
        UserDocument user = usuario("u1");
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));
        when(mongoTemplate.find(any(Query.class), eq(VisitaDocument.class))).thenReturn(List.of());
        when(mongoTemplate.find(any(Query.class), eq(FeedbackDocument.class))).thenReturn(List.of());

        Map<String, Object> dados = userService.exportarDados("u1");

        assertEquals("Marina Souza", ((Map<?, ?>) dados.get("usuario")).get("nome"));
        verify(mongoTemplate).find(any(Query.class), eq(VisitaDocument.class));
        verify(mongoTemplate).find(any(Query.class), eq(FeedbackDocument.class));
    }

    @Test
    void deveRegistrarRevogacaoDeConsentimentoComDataEVersao() {
        UserDocument user = usuario("u1");
        user.getConsentimentos().setLocalizacao(
                ConsentimentoItem.builder().aceito(true).data(Instant.parse("2026-08-01T12:00:00Z"))
                        .versao("1.0").build());
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));
        when(userRepository.save(any(UserDocument.class))).thenAnswer(inv -> inv.getArgument(0));

        ConsentimentosResponse resposta = userService.atualizarConsentimentos("u1",
                new AtualizarConsentimentosRequest(false, null, null));

        assertFalse(resposta.localizacao().aceito());
        // A versão do aviso originalmente aceito é preservada — é o comprovante da
        // base legal sob a qual os dados foram tratados até a revogação.
        assertEquals("1.0", resposta.localizacao().versao());
        assertNotEquals(Instant.parse("2026-08-01T12:00:00Z"), resposta.localizacao().data());
        verify(userRepository).save(user);
    }

    @Test
    void deveAtualizarApenasAsFinalidadesInformadas() {
        UserDocument user = usuario("u1");
        user.getConsentimentos().setNotificacoes(
                ConsentimentoItem.builder().aceito(true).data(Instant.parse("2026-08-01T12:00:00Z"))
                        .versao("1.0").build());
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));
        when(userRepository.save(any(UserDocument.class))).thenAnswer(inv -> inv.getArgument(0));

        ConsentimentosResponse resposta = userService.atualizarConsentimentos("u1",
                new AtualizarConsentimentosRequest(true, null, "2.0"));

        assertTrue(resposta.localizacao().aceito());
        assertEquals("2.0", resposta.localizacao().versao());
        assertTrue(resposta.notificacoes().aceito());
        assertEquals(Instant.parse("2026-08-01T12:00:00Z"), resposta.notificacoes().data());
    }

    @Test
    void deveRejeitarAtualizacaoSemNenhumaFinalidade() {
        assertThrows(ValidacaoNegocioException.class, () -> userService.atualizarConsentimentos("u1",
                new AtualizarConsentimentosRequest(null, null, "1.0")));
        verify(userRepository, never()).save(any(UserDocument.class));
    }

    @Test
    void deveLancarNaoEncontradoAoAtualizarConsentimentosDeUsuarioInexistente() {
        when(userRepository.findById("x")).thenReturn(Optional.empty());

        assertThrows(RecursoNaoEncontradoException.class, () -> userService.atualizarConsentimentos("x",
                new AtualizarConsentimentosRequest(false, null, null)));
    }

    @Test
    void deveRecalcularAgregadosDosHospitaisAfetados() {
        UserDocument user = usuario("u2");
        when(userRepository.findById("u2")).thenReturn(Optional.of(user));

        VisitaDocument visita = VisitaDocument.builder().hospitalId("h1").build();
        FeedbackDocument feedback = FeedbackDocument.builder().hospitalId("h2").build();
        when(mongoTemplate.find(any(Query.class), eq(VisitaDocument.class)))
                .thenReturn(List.of(visita));
        when(mongoTemplate.find(any(Query.class), eq(FeedbackDocument.class)))
                .thenReturn(List.of(feedback));

        userService.excluirConta("u2");

        verify(agregadoService).recalcular("h1");
        verify(agregadoService).recalcular("h2");
    }
}
