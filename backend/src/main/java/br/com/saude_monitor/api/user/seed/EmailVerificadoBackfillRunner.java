package br.com.saude_monitor.api.user.seed;

import br.com.saude_monitor.api.user.document.UserDocument;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

/**
 * Migra, no startup, os usuários cadastrados antes da confirmação obrigatória de e-mail
 * (10/09/2026) para {@code emailVerificado = true}.
 *
 * <p><b>Por que existe:</b> sem este backfill, todo usuário já cadastrado antes desta
 * feature ficaria com {@code emailVerificado} ausente — que o Java desserializa como
 * {@code false} (booleano primitivo) — e seria trancado para fora no próximo login,
 * exatamente o "efeito cobra" que uma correção não pode causar: nunca receberam nenhum
 * código de confirmação, porque a feature não existia quando se cadastraram.</p>
 *
 * <p><b>Idempotente:</b> o filtro é "campo ausente no documento" ({@code $exists: false}).
 * Depois da primeira execução, todo documento já tem o campo (seja da migração, seja de
 * um cadastro novo com {@code emailVerificado=false} explícito) — a segunda execução não
 * casa com nenhum documento e não regrava nada.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EmailVerificadoBackfillRunner implements ApplicationRunner {

    private final MongoTemplate mongoTemplate;

    @Override
    public void run(ApplicationArguments args) {
        Query query = Query.query(Criteria.where("emailVerificado").exists(false));
        Update update = new Update().set("emailVerificado", true);
        long migrados = mongoTemplate.updateMulti(query, update, UserDocument.class).getModifiedCount();

        if (migrados > 0) {
            log.info("[EmailVerificadoBackfill] {} usuário(s) anteriores à confirmação de "
                    + "e-mail migrados para emailVerificado=true.", migrados);
        }
    }
}
