package br.com.saude_monitor.api.user.seed;

import br.com.saude_monitor.api.user.document.UserDocument;
import com.mongodb.client.result.UpdateResult;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Testes do backfill de {@code emailVerificado} para contas anteriores à confirmação
 * obrigatória de e-mail no cadastro (10/09/2026).
 */
class EmailVerificadoBackfillRunnerTest {

    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final EmailVerificadoBackfillRunner runner = new EmailVerificadoBackfillRunner(mongoTemplate);

    @Test
    void migraUsuariosSemOCampoParaEmailVerificadoTrue() {
        UpdateResult resultado = mock(UpdateResult.class);
        when(resultado.getModifiedCount()).thenReturn(3L);
        when(mongoTemplate.updateMulti(any(Query.class), any(Update.class), eq(UserDocument.class)))
                .thenReturn(resultado);

        runner.run(null);

        ArgumentCaptor<Query> queryCaptor = ArgumentCaptor.forClass(Query.class);
        ArgumentCaptor<Update> updateCaptor = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).updateMulti(queryCaptor.capture(), updateCaptor.capture(), eq(UserDocument.class));

        // Filtro é "campo ausente" — é isso que torna a migração idempotente (ver Javadoc
        // do runner): usuário novo, com `emailVerificado=false` explícito, tem o campo
        // presente e não casa com este filtro na segunda execução.
        Document queryDoc = queryCaptor.getValue().getQueryObject();
        Document existsClause = (Document) queryDoc.get("emailVerificado");
        assertEquals(false, existsClause.getBoolean("$exists"));

        Document setDoc = (Document) updateCaptor.getValue().getUpdateObject().get("$set");
        assertEquals(true, setDoc.getBoolean("emailVerificado"));
    }

    @Test
    void naoQuebraQuandoNaoHaNadaParaMigrar() {
        UpdateResult resultado = mock(UpdateResult.class);
        when(resultado.getModifiedCount()).thenReturn(0L);
        when(mongoTemplate.updateMulti(any(Query.class), any(Update.class), eq(UserDocument.class)))
                .thenReturn(resultado);

        // Segunda execução (idempotente): nenhum documento casa com o filtro, nada quebra.
        runner.run(null);
        runner.run(null);

        verify(mongoTemplate, times(2))
                .updateMulti(any(Query.class), any(Update.class), eq(UserDocument.class));
    }
}
