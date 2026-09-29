package br.com.saude_monitor.api.feedback.seed;

import br.com.saude_monitor.api.agregado.service.AgregadoService;
import br.com.saude_monitor.api.feedback.document.FeedbackDocument;
import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.user.document.Papel;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.result.DeleteResult;
import com.mongodb.client.result.UpdateResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class MassaAvaliacoesRunnerTest {

    private MongoTemplate mongoTemplate;
    private PasswordEncoder passwordEncoder;
    private AgregadoService agregadoService;
    private MongoDatabase database;

    @BeforeEach
    void setUp() {
        mongoTemplate = mock(MongoTemplate.class);
        passwordEncoder = mock(PasswordEncoder.class);
        agregadoService = mock(AgregadoService.class);
        database = mock(MongoDatabase.class);
        when(mongoTemplate.getDb()).thenReturn(database);
        when(database.getName()).thenReturn("saude_monitor_dev");
        when(passwordEncoder.encode(anyString())).thenReturn("hash");
    }

    private MassaAvaliacoesRunner runner(String modo, String senha) {
        return new MassaAvaliacoesRunner(mongoTemplate, passwordEncoder, agregadoService,
                new MassaAvaliacoesProperties(true, modo, senha));
    }

    private void comHospitaisAtivos(int quantidade) {
        List<HospitalDocument> hospitais = IntStream.range(0, quantidade)
                .mapToObj(i -> HospitalDocument.builder()
                        .id("h-" + i).categoria(CategoriaEstabelecimento.HOSPITAL).ativo(true).build())
                .toList();
        when(mongoTemplate.find(any(Query.class), eq(HospitalDocument.class))).thenReturn(hospitais);
    }

    @SuppressWarnings("unchecked")
    private <T> List<T> inserido(Class<T> tipo) {
        ArgumentCaptor<Collection<Object>> captor = ArgumentCaptor.forClass(Collection.class);
        verify(mongoTemplate, times(3)).insertAll(captor.capture());
        return captor.getAllValues().stream()
                .flatMap(Collection::stream)
                .filter(tipo::isInstance)
                .map(tipo::cast)
                .toList();
    }

    private void comMassaCompleta(Instant criadaEm, String senhaHash) {
        when(mongoTemplate.exists(any(Query.class), eq(FeedbackDocument.class))).thenReturn(true);
        when(mongoTemplate.findById(MassaAvaliacoesRunner.PRIMEIRO_USUARIO, UserDocument.class))
                .thenReturn(UserDocument.builder().createdAt(criadaEm).senhaHash(senhaHash).build());
        when(mongoTemplate.findDistinct(any(Query.class), eq("hospitalId"), eq(FeedbackDocument.class), eq(String.class)))
                .thenReturn(List.of("hospital-da-massa"));
        when(mongoTemplate.remove(any(Query.class), any(Class.class))).thenReturn(DeleteResult.acknowledged(1));
        when(mongoTemplate.updateMulti(any(Query.class), any(Update.class), eq(UserDocument.class)))
                .thenReturn(UpdateResult.acknowledged(30, 30L, null));
    }

    private void verificaQueRegerou() {
        verify(mongoTemplate).remove(any(Query.class), eq(FeedbackDocument.class));
        verify(mongoTemplate).remove(any(Query.class), eq(VisitaDocument.class));
        verify(mongoTemplate).remove(any(Query.class), eq(UserDocument.class));
        verify(mongoTemplate, times(3)).insertAll(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"saude_monitor_hom", "saude_monitor_prod", "SAUDE_MONITOR_HOM", "saude_monitor",
            "saude_monitor_dev_hom", "radar"})
    void recusaBancoQueNaoEDeDesenvolvimento(String banco) {
        when(database.getName()).thenReturn(banco);

        runner(null, "senha").run(null);

        verify(mongoTemplate, never()).exists(any(Query.class), any(Class.class));
        verify(mongoTemplate, never()).insertAll(any());
        verifyNoInteractions(agregadoService);
    }

    @Test
    void aceitaBancoDeTesteDoTestcontainers() {
        when(database.getName()).thenReturn("test");
        comHospitaisAtivos(5);

        runner(null, "senha").run(null);

        verify(mongoTemplate, times(3)).insertAll(any());
    }

    @Test
    void massaCompletaERecenteSoRecalculaOsAgregados() {
        comMassaCompleta(Instant.now().minus(Duration.ofDays(3)), "hash");
        when(passwordEncoder.matches("senha", "hash")).thenReturn(true);

        runner("skip-if-present", "senha").run(null);

        verify(agregadoService).recalcular("hospital-da-massa");
        verify(mongoTemplate, never()).insertAll(any());
        verify(mongoTemplate, never()).remove(any(Query.class), any(Class.class));
        verify(mongoTemplate, never()).updateMulti(any(Query.class), any(Update.class), eq(UserDocument.class));
    }

    @Test
    void massaComMaisDeTrintaDiasERegeradaComDatasAtuais() {
        comMassaCompleta(Instant.now().minus(Duration.ofDays(31)), "hash");
        comHospitaisAtivos(10);

        runner(null, "senha").run(null);

        verificaQueRegerou();
        verify(agregadoService).recalcular("hospital-da-massa");
    }

    @Test
    void restoDeCargaInterrompidaEApagadoERegerado() {
        when(mongoTemplate.exists(any(Query.class), eq(UserDocument.class))).thenReturn(true);
        when(mongoTemplate.remove(any(Query.class), any(Class.class))).thenReturn(DeleteResult.acknowledged(1));
        comHospitaisAtivos(10);

        runner(null, "senha").run(null);

        verificaQueRegerou();
    }

    @Test
    void massaExistenteRecebeASenhaConfiguradaDepoisDaCarga() {
        comMassaCompleta(Instant.now(), "hash-antigo");
        when(passwordEncoder.matches("nova", "hash-antigo")).thenReturn(false);

        runner(null, "nova").run(null);

        verify(passwordEncoder).encode("nova");
        ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).updateMulti(any(Query.class), update.capture(), eq(UserDocument.class));
        assertThat(update.getValue().getUpdateObject().get("$set", org.bson.Document.class))
                .containsKeys("senhaHash", "senhaAlteradaEm");
        verify(mongoTemplate, never()).insertAll(any());
    }

    @Test
    void tirarASenhaDaConfiguracaoBloqueiaOLoginDeNovo() {
        comMassaCompleta(Instant.now(), "hash-da-senha-antiga");

        runner(null, null).run(null);

        ArgumentCaptor<String> senha = ArgumentCaptor.forClass(String.class);
        verify(passwordEncoder).encode(senha.capture());
        assertThat(senha.getValue()).hasSizeGreaterThan(30);
        verify(mongoTemplate).updateMulti(any(Query.class), any(Update.class), eq(UserDocument.class));
    }

    @Test
    void injetaUsuariosVisitasEAvaliacoesERecalculaOsAgregados() {
        comHospitaisAtivos(80);

        runner(null, "S3nh@Dev").run(null);

        List<UserDocument> usuarios = inserido(UserDocument.class);
        assertThat(usuarios).hasSize(MassaAvaliacoesRunner.QUANTIDADE_USUARIOS)
                .allMatch(u -> u.getPapel() == Papel.USER && u.isActive() && u.isEmailVerificado())
                .allMatch(u -> u.getEmail().endsWith("@" + MassaAvaliacoesRunner.DOMINIO_EMAIL))
                .allMatch(u -> u.getId().startsWith(MassaAvaliacoesGerador.PREFIXO_ID))
                .allMatch(u -> u.getConsentimentos().getTermosUso().isAceito());
        assertThat(usuarios.getFirst().getId()).isEqualTo(MassaAvaliacoesRunner.PRIMEIRO_USUARIO);
        assertThat(usuarios).extracting(UserDocument::getEmail).doesNotHaveDuplicates();
        assertThat(inserido(VisitaDocument.class)).isNotEmpty();
        List<FeedbackDocument> feedbacks = inserido(FeedbackDocument.class);
        assertThat(feedbacks).isNotEmpty();

        verify(passwordEncoder).encode("S3nh@Dev");
        verify(mongoTemplate, never()).remove(any(Query.class), any(Class.class));
        long hospitaisComAvaliacao = feedbacks.stream().map(FeedbackDocument::getHospitalId).distinct().count();
        verify(agregadoService, times((int) hospitaisComAvaliacao)).recalcular(anyString());
    }

    @Test
    void semSenhaConfiguradaOsUsuariosRecebemSenhaAleatoria() {
        comHospitaisAtivos(10);

        runner(null, " ").run(null);

        ArgumentCaptor<String> senha = ArgumentCaptor.forClass(String.class);
        verify(passwordEncoder).encode(senha.capture());
        assertThat(senha.getValue()).isNotBlank().hasSizeGreaterThan(30);
    }

    @Test
    void modoRecriarApagaSoAMassaAnteriorERecalculaOsHospitaisAntigos() {
        comMassaCompleta(Instant.now(), "hash");
        comHospitaisAtivos(10);

        runner("RECRIAR", "senha").run(null);

        ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).remove(query.capture(), eq(FeedbackDocument.class));
        assertThat(query.getValue().getQueryObject().toJson()).contains(MassaAvaliacoesGerador.PREFIXO_ID);
        verificaQueRegerou();
        verify(agregadoService).recalcular("hospital-da-massa");
    }

    @Test
    void semHospitalAtivoNaoGravaNada() {
        comHospitaisAtivos(0);

        runner(null, "senha").run(null);

        verify(mongoTemplate, never()).insertAll(any());
        verifyNoInteractions(agregadoService);
    }

    @Test
    void falhaNoBancoNaoDerrubaAAplicacao() {
        comHospitaisAtivos(10);
        when(mongoTemplate.insertAll(any())).thenThrow(new DataAccessResourceFailureException("Atlas fora"));

        assertThatCode(() -> runner(null, "senha").run(null)).doesNotThrowAnyException();
        verifyNoInteractions(agregadoService);
    }
}
