package br.com.saude_monitor.api.feedback.seed;

import br.com.saude_monitor.api.agregado.service.AgregadoService;
import br.com.saude_monitor.api.feedback.document.FeedbackDocument;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.user.document.ConsentimentoItem;
import br.com.saude_monitor.api.user.document.ConsentimentosDocument;
import br.com.saude_monitor.api.user.document.Papel;
import br.com.saude_monitor.api.user.document.UserDocument;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Injeta a massa de dados de avaliações no ambiente de desenvolvimento: usuários de
 * teste, visitas finalizadas e avaliações distribuídas em parte dos hospitais ativos,
 * seguidas do recálculo dos agregados — o suficiente para testar a avaliação, a
 * visualização dos indicadores e o ranking (E4-05) sem precisar de visitas reais.
 *
 * <p><b>Nunca roda fora de desenvolvimento.</b> São três travas independentes: o perfil
 * Spring {@code dev}, a propriedade {@code app.massa-avaliacoes.enabled=true} (padrão
 * {@code false}) e o nome do banco, que precisa conter {@code dev} ou {@code test} e não
 * pode conter {@code hom} nem {@code prod}.</p>
 *
 * <p><b>Idempotente:</b> todo documento gerado tem {@code _id} com o prefixo
 * {@value MassaAvaliacoesGerador#PREFIXO_ID}, e só eles são apagados ou regerados. Com a
 * massa completa, o boot só recalcula os agregados e sincroniza a senha. A massa é regerada
 * com datas atuais quando tem mais de 30 dias (antes de sair da janela de 90 dias, RN-14),
 * quando sobrou uma carga interrompida ou no modo {@code recriar}.</p>
 *
 * <p><b>Fora do caminho de startup:</b> roda em segundo plano depois de
 * {@link ApplicationReadyEvent} (os seeds de hospitais já terminaram). Como
 * {@code ApplicationRunner}, a carga segurava o readiness em {@code OUT_OF_SERVICE}: no
 * Cloud Run a CPU fica quase parada fora de requisição depois que a porta abre, a carga
 * não terminava a tempo e o smoke test do deploy do dev (29/09/2026) recebia 503 em
 * {@code /actuator/health}.</p>
 */
@Slf4j
@Component
@Profile("dev")
@ConditionalOnProperty(prefix = "app.massa-avaliacoes", name = "enabled", havingValue = "true")
@RequiredArgsConstructor
public class MassaAvaliacoesRunner {

    /** Semente fixa: a mesma base de hospitais gera sempre a mesma distribuição. */
    static final long SEMENTE = 20260929L;

    static final int QUANTIDADE_USUARIOS = 30;

    static final String DOMINIO_EMAIL = "radarsaude.invalid";

    /** Idade a partir da qual a massa é regerada sozinha: antes de sair da janela de 90 dias (RN-14). */
    static final Duration VALIDADE_MASSA = Duration.ofDays(30);

    /** O banco precisa indicar desenvolvimento ou teste... */
    private static final Pattern BANCO_PERMITIDO = Pattern.compile(".*(dev|test).*");

    /** ...e não pode indicar homologação ou produção. */
    private static final Pattern BANCO_PROIBIDO = Pattern.compile(".*(hom|prod).*");

    private static final Pattern PREFIXO = Pattern.compile("^" + Pattern.quote(MassaAvaliacoesGerador.PREFIXO_ID));

    /** Usuário gravado primeiro em toda carga; o {@code createdAt} dele é a data da carga. */
    static final String PRIMEIRO_USUARIO = MassaAvaliacoesGerador.PREFIXO_ID + "usuario-01";

    static final List<String> NOMES = List.of(
            "Ana", "Bruno", "Carla", "Diego", "Elaine", "Fábio", "Gabriela", "Heitor", "Isabela", "João",
            "Karina", "Lucas", "Marina", "Nelson", "Olívia", "Paulo", "Quitéria", "Rafael", "Sílvia", "Tiago",
            "Úrsula", "Vinícius", "Wanda", "Xavier", "Yara", "Zeca", "Beatriz", "Caio", "Débora", "Eduardo");

    private final MongoTemplate mongoTemplate;
    private final PasswordEncoder passwordEncoder;
    private final AgregadoService agregadoService;
    private final MassaAvaliacoesProperties properties;

    /** Dispara a carga em segundo plano quando a aplicação está pronta. */
    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void aoFicarPronta() {
        executarCarga();
    }

    /**
     * A massa é opcional: qualquer falha é registrada e a aplicação segue — um erro aqui
     * não pode derrubar o ambiente de desenvolvimento.
     */
    public void executarCarga() {
        try {
            executar();
        } catch (RuntimeException e) {
            log.error("[MassaAvaliacoes] Falha na carga da massa de avaliações; a aplicação segue sem ela.", e);
        }
    }

    private void executar() {
        String banco = mongoTemplate.getDb().getName();
        String nome = banco.toLowerCase(Locale.ROOT);
        if (!BANCO_PERMITIDO.matcher(nome).matches() || BANCO_PROIBIDO.matcher(nome).matches()) {
            log.error("[MassaAvaliacoes] Banco '{}' não é de desenvolvimento (o nome precisa conter "
                    + "'dev' ou 'test' e não conter 'hom' nem 'prod'). Carga RECUSADA.", banco);
            return;
        }

        Instant agora = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        Query daMassa = daMassa();
        boolean completa = mongoTemplate.exists(daMassa, FeedbackDocument.class);
        boolean resto = completa
                || mongoTemplate.exists(daMassa, UserDocument.class)
                || mongoTemplate.exists(daMassa, VisitaDocument.class);

        if (completa && !properties.recriar() && !vencida(agora)) {
            sincronizarSenha(agora);
            // Recalcula a cada boot: sem atividade recente, o job de 15 min não olharia
            // para estes hospitais e os indicadores ficariam congelados no dia da carga.
            List<String> hospitais = mongoTemplate.findDistinct(daMassa, "hospitalId", FeedbackDocument.class, String.class);
            hospitais.forEach(agregadoService::recalcular);
            log.info("[MassaAvaliacoes] Massa já presente no banco '{}'; agregados de {} hospitais recalculados.",
                    banco, hospitais.size());
            return;
        }

        // Massa pedida de novo, vencida, ou resto de uma carga interrompida: apaga só ela.
        Set<String> hospitaisAfetados = resto ? apagarMassa() : new HashSet<>();

        Query ativos = Query.query(Criteria.where("ativo").is(true));
        ativos.fields().include("_id", "categoria");
        List<HospitalDocument> hospitais = mongoTemplate.find(ativos, HospitalDocument.class);
        if (hospitais.isEmpty()) {
            log.warn("[MassaAvaliacoes] Nenhum hospital ativo no banco '{}'. Carga ignorada.", banco);
            hospitaisAfetados.forEach(agregadoService::recalcular);
            return;
        }

        List<UserDocument> usuarios = usuarios(agora);
        mongoTemplate.insertAll(usuarios);

        MassaAvaliacoesGerador.Massa massa = new MassaAvaliacoesGerador(SEMENTE, agora)
                .gerar(hospitais, usuarios.stream().map(UserDocument::getId).toList());
        mongoTemplate.insertAll(massa.visitas());
        // Avaliações por último: são elas que marcam a carga como completa.
        mongoTemplate.insertAll(massa.feedbacks());

        hospitaisAfetados.addAll(massa.perfilPorHospital().keySet());
        hospitaisAfetados.forEach(agregadoService::recalcular);

        log.info("[MassaAvaliacoes] Banco '{}': {} usuários, {} visitas e {} avaliações em {} hospitais "
                        + "({} ativos ficaram sem avaliação). Senha dos usuários {}.",
                banco, usuarios.size(), massa.visitas().size(), massa.feedbacks().size(),
                massa.perfilPorHospital().size(), hospitais.size() - massa.perfilPorHospital().size(),
                temSenha() ? "configurada" : "NÃO configurada (sem login)");
    }

    private static Query daMassa() {
        return Query.query(Criteria.where("_id").regex(PREFIXO));
    }

    /** Carga com mais de {@link #VALIDADE_MASSA} (ou sem data) é regerada com datas atuais. */
    private boolean vencida(Instant agora) {
        UserDocument primeiro = mongoTemplate.findById(PRIMEIRO_USUARIO, UserDocument.class);
        return primeiro == null
                || primeiro.getCreatedAt() == null
                || primeiro.getCreatedAt().isBefore(agora.minus(VALIDADE_MASSA));
    }

    /** Apaga só os documentos da massa e devolve os hospitais cujo agregado precisa ser recalculado. */
    private Set<String> apagarMassa() {
        Query daMassa = daMassa();
        Set<String> hospitais = new HashSet<>(
                mongoTemplate.findDistinct(daMassa, "hospitalId", FeedbackDocument.class, String.class));
        long feedbacks = mongoTemplate.remove(daMassa, FeedbackDocument.class).getDeletedCount();
        long visitas = mongoTemplate.remove(daMassa, VisitaDocument.class).getDeletedCount();
        long usuarios = mongoTemplate.remove(daMassa, UserDocument.class).getDeletedCount();
        log.info("[MassaAvaliacoes] Massa anterior removida: {} avaliações, {} visitas e {} usuários.",
                feedbacks, visitas, usuarios);
        return hospitais;
    }

    /**
     * Mantém a senha dos usuários de teste igual à configuração a cada boot. Com senha
     * configurada, ela é aplicada se ainda não estiver valendo (ex.: definida no serviço
     * depois da carga). Sem senha, os usuários recebem uma senha aleatória — tirar a senha
     * da configuração bloqueia o login de novo. Nos dois casos {@code senhaAlteradaEm}
     * avança e os refresh tokens anteriores deixam de valer.
     */
    private void sincronizarSenha(Instant agora) {
        String senha;
        if (temSenha()) {
            UserDocument primeiro = mongoTemplate.findById(PRIMEIRO_USUARIO, UserDocument.class);
            if (primeiro != null && passwordEncoder.matches(properties.senha(), primeiro.getSenhaHash())) {
                return;
            }
            senha = properties.senha();
        } else {
            senha = UUID.randomUUID().toString();
        }
        long atualizados = mongoTemplate.updateMulti(daMassa(),
                        new Update().set("senhaHash", passwordEncoder.encode(senha)).set("senhaAlteradaEm", agora),
                        UserDocument.class)
                .getModifiedCount();
        log.info("[MassaAvaliacoes] Senha dos usuários de teste {} ({} usuários).",
                temSenha() ? "aplicada" : "trocada por uma aleatória (sem login)", atualizados);
    }

    private List<UserDocument> usuarios(Instant agora) {
        // Um único hash para todos: BCrypt custa ~100 ms por chamada no startup.
        String senhaHash = passwordEncoder.encode(temSenha() ? properties.senha() : UUID.randomUUID().toString());
        ConsentimentoItem aceite = ConsentimentoItem.builder().aceito(true).data(agora).versao("1.0").build();
        List<UserDocument> usuarios = new ArrayList<>();
        for (int i = 1; i <= QUANTIDADE_USUARIOS; i++) {
            String numero = "%02d".formatted(i);
            usuarios.add(UserDocument.builder()
                    .id(MassaAvaliacoesGerador.PREFIXO_ID + "usuario-" + numero)
                    .fullName(NOMES.get((i - 1) % NOMES.size()) + " Teste " + numero)
                    .email("massa.avaliacoes." + numero + "@" + DOMINIO_EMAIL)
                    .senhaHash(senhaHash)
                    .papel(Papel.USER)
                    .consentimentos(ConsentimentosDocument.builder().termosUso(aceite).build())
                    .active(true)
                    .emailVerificado(true)
                    .createdAt(agora)
                    .updatedAt(agora)
                    .build());
        }
        return usuarios;
    }

    private boolean temSenha() {
        return properties.senha() != null && !properties.senha().isBlank();
    }
}
