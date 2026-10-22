package br.com.saude_monitor.api.feedback.service.impl;

import br.com.saude_monitor.api.indicador.event.FeedbackSalvoEvent;
import br.com.saude_monitor.api.config.exception.AcessoNegadoException;
import br.com.saude_monitor.api.config.exception.ConflitoException;
import br.com.saude_monitor.api.config.exception.RecursoNaoEncontradoException;
import br.com.saude_monitor.api.config.exception.ValidacaoNegocioException;
import br.com.saude_monitor.api.feedback.document.FeedbackDocument;
import br.com.saude_monitor.api.feedback.document.FoiAtendido;
import br.com.saude_monitor.api.feedback.document.MotivoNaoAtendido;
import br.com.saude_monitor.api.feedback.dto.FeedbackPendenteResponse;
import br.com.saude_monitor.api.feedback.dto.FeedbackRequest;
import br.com.saude_monitor.api.feedback.dto.FeedbackResponse;
import br.com.saude_monitor.api.feedback.repository.FeedbackRepository;
import br.com.saude_monitor.api.feedback.service.FeedbackService;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.dto.PageResponse;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.visita.document.StatusVisita;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import br.com.saude_monitor.api.visita.service.VisitaDono;
import br.com.saude_monitor.api.visita.service.VisitaService;
import br.com.saude_monitor.api.visita.repository.VisitaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Implementação do serviço de feedback pós-saída (Épico 03 / F-05).
 *
 * <p>Regras aplicadas: dedupe 1 feedback por visita (RN-12, via {@code visitaId} único);
 * feedback anônimo sem {@code usuarioId} (RN-13); a visita deve estar {@code FINALIZADA}
 * ou {@code GPS_INTERROMPIDO} (não é possível avaliar visita em andamento); janela de 24h
 * a partir da saída para responder e prazo de 15 dias a partir da criação para o dono
 * editar (RN-09);
 * {@code motivoNaoAtendido} obrigatório quando {@code foiAtendido = NAO} (RN-10).</p>
 */
@Service
@RequiredArgsConstructor
public class FeedbackServiceImpl implements FeedbackService {

    /** Janela de 24h para responder o feedback após a saída (RN-09). */
    private static final Duration JANELA_RESPOSTA = Duration.ofHours(24);

    /**
     * Prazo para o dono editar a avaliação, contado da criação (RN-09, decisão do PO em
     * 22/10/2026): pode editar quantas vezes quiser dentro dele.
     */
    public static final Duration PRAZO_EDICAO = Duration.ofDays(15);

    /** Label amigável enviado pelo frontend (F-05); o backend normaliza para CLASSIFICACAO_RISCO. */
    private static final String LABEL_CASOS_MAIS_GRAVES = "CASOS_MAIS_GRAVES_PRIORIDADE";

    /** Piso de duração para convidar ao feedback (RN-01/RN-07), o mesmo do app. */
    private static final int DURACAO_MINIMA_FEEDBACK_MIN = 2;

    /**
     * Visitas encerradas que aceitam feedback. {@code GPS_INTERROMPIDO} entra porque é o
     * que o backend registra quando o celular descarrega ou desliga dentro do hospital
     * (RN-06): o usuário esteve lá e foi atendido, só o aparelho é que parou de responder.
     */
    private static final List<StatusVisita> STATUS_AVALIAVEIS =
            List.of(StatusVisita.FINALIZADA, StatusVisita.GPS_INTERROMPIDO);

    private final FeedbackRepository feedbackRepository;
    private final VisitaRepository visitaRepository;
    private final HospitalRepository hospitalRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final MongoTemplate mongoTemplate;

    @Override
    public FeedbackResponse criar(FeedbackRequest request, String usuarioId) {
        VisitaDocument visita = obterVisitaAvaliavel(request.visitaId(), usuarioId, request.dispositivoId());

        if (feedbackRepository.existsByVisitaId(request.visitaId())) {
            throw new ConflitoException("Você já avaliou esta visita.");
        }

        validarMotivoNaoAtendido(request);

        Instant agora = Instant.now();
        FeedbackDocument feedback = FeedbackDocument.builder()
                .visitaId(visita.getId())
                .usuarioId(usuarioId)
                .hospitalId(visita.getHospitalId())
                .especialidadeProcurada(request.especialidadeProcurada())
                .foiAtendido(request.foiAtendido())
                .motivoNaoAtendido(normalizarMotivo(request.motivoNaoAtendido()))
                .teveMedico(request.teveMedico())
                .fezTriagem(request.fezTriagem())
                .medicacaoReceita(request.medicacaoReceita())
                .nota(request.nota())
                .tratamentoEquipe(request.tratamentoEquipe())
                .comentario(request.comentario())
                .anonimizado(usuarioId == null)
                .criadoEm(agora)
                .build();

        FeedbackDocument salvo;
        try {
            salvo = feedbackRepository.save(feedback);
        } catch (org.springframework.dao.DuplicateKeyException e) {
            // Corrida entre a checagem acima (linha 58) e este save: um retry do cliente
            // em 502/503/504 (frontend marca `enviar`/`atualizar` como idempotente) pode
            // chegar ao servidor enquanto a tentativa original ainda está processando —
            // ambas passam por `existsByVisitaId` antes de qualquer uma salvar. O índice
            // único em `visitaId` pega o que a checagem em memória não pegou; sem este
            // catch, a exceção vazava como 500 genérico em vez do 409 que o frontend já
            // trata como sucesso silencioso (achado do code-review de 09/09/2026).
            throw new ConflitoException("Você já avaliou esta visita.");
        }

        // Dispara o recálculo assíncrono do indicador do hospital (Épico 04, RN-18).
        // AFTER_COMMIT no listener garante que só recalcula depois do commit desta transação.
        eventPublisher.publishEvent(new FeedbackSalvoEvent(salvo.getHospitalId()));

        // Sem o nome do hospital: o envio é o caminho mais quente e o app já o tem na tela.
        return toResponse(salvo, null);
    }

    @Override
    public Optional<FeedbackResponse> buscarPorVisita(String visitaId, String usuarioId) {
        FeedbackDocument feedback = feedbackRepository.findByVisitaId(visitaId).orElse(null);
        if (feedback == null) {
            return Optional.empty();
        }
        exigirDono(feedback, usuarioId);
        return Optional.of(toResponse(feedback, obterNomeHospital(feedback.getHospitalId())));
    }

    @Override
    public FeedbackResponse atualizar(String id, FeedbackRequest request, String usuarioId) {
        FeedbackDocument feedback = feedbackRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Feedback não encontrado para o id informado."));
        exigirDono(feedback, usuarioId);

        Instant agora = Instant.now();
        Instant editavelAte = calcularEditavelAte(feedback);
        if (editavelAte == null || agora.isAfter(editavelAte)) {
            throw new ConflitoException("O prazo de 15 dias para editar esta avaliação já encerrou.");
        }
        validarMotivoNaoAtendido(request);

        feedback.setEspecialidadeProcurada(request.especialidadeProcurada());
        feedback.setFoiAtendido(request.foiAtendido());
        feedback.setMotivoNaoAtendido(normalizarMotivo(request.motivoNaoAtendido()));
        feedback.setTeveMedico(request.teveMedico());
        feedback.setFezTriagem(request.fezTriagem());
        feedback.setMedicacaoReceita(request.medicacaoReceita());
        feedback.setNota(request.nota());
        feedback.setTratamentoEquipe(request.tratamentoEquipe());
        feedback.setComentario(request.comentario());
        feedback.setEditadoEm(agora);

        FeedbackDocument salvo = feedbackRepository.save(feedback);

        // A edição pode alterar a nota — recalcula o indicador (RN-18). A visita não muda,
        // então a prova de presença (SEG-01) que valia na criação continua valendo.
        eventPublisher.publishEvent(new FeedbackSalvoEvent(salvo.getHospitalId()));

        return toResponse(salvo, obterNomeHospital(salvo.getHospitalId()));
    }

    @Override
    public PageResponse<FeedbackResponse> historico(String usuarioId, int page, int size) {
        Page<FeedbackDocument> resultado = feedbackRepository
                .findByUsuarioIdOrderByCriadoEmDesc(usuarioId, PageRequest.of(page, size));
        Map<String, String> nomes = obterNomesHospitais(resultado.getContent().stream()
                .map(FeedbackDocument::getHospitalId).toList());
        List<FeedbackResponse> content = resultado.getContent().stream()
                .map(f -> toResponse(f, nomes.get(f.getHospitalId())))
                .toList();
        return PageResponse.of(content, page, size, resultado.getTotalElements());
    }

    @Override
    public List<FeedbackPendenteResponse> pendentes(String usuarioId) {
        List<VisitaDocument> candidatas = visitaRepository
                .findByUsuarioIdAndStatusInAndSaidaAfterOrderBySaidaDesc(
                        usuarioId, STATUS_AVALIAVEIS, Instant.now().minus(JANELA_RESPOSTA))
                .stream()
                .filter(v -> v.getDuracaoMinutos() == null
                        || v.getDuracaoMinutos() >= DURACAO_MINIMA_FEEDBACK_MIN)
                .toList();
        if (candidatas.isEmpty()) {
            return List.of();
        }

        // Em lote (sem N+1), como no job de SEM_FEEDBACK abaixo.
        Set<String> comFeedback = feedbackRepository
                .findByVisitaIdIn(candidatas.stream().map(VisitaDocument::getId).toList()).stream()
                .map(FeedbackDocument::getVisitaId)
                .collect(Collectors.toSet());
        List<VisitaDocument> semFeedback = candidatas.stream()
                .filter(v -> !comFeedback.contains(v.getId()))
                .toList();

        Map<String, String> nomes = obterNomesHospitais(semFeedback.stream()
                .map(VisitaDocument::getHospitalId).toList());

        return semFeedback.stream()
                .map(v -> new FeedbackPendenteResponse(
                        v.getId(), v.getHospitalId(), nomes.get(v.getHospitalId()),
                        v.getSaida(), v.getSaida().plus(JANELA_RESPOSTA)))
                .toList();
    }

    @Override
    public void processarSemResposta() {
        Instant limite = Instant.now().minus(JANELA_RESPOSTA);
        List<VisitaDocument> encerradas = visitaRepository
                .findByStatusAndSaidaBefore(StatusVisita.FINALIZADA, limite);

        // Antes chamava existsByVisitaId dentro do loop (N+1) e salvava a lista inteira,
        // inclusive as visitas que já tinham feedback e não foram alteradas. Agora busca
        // o feedback de todas de uma vez e só salva quem de fato mudou de status.
        List<String> visitaIds = encerradas.stream().map(VisitaDocument::getId).toList();
        Set<String> comFeedback = feedbackRepository.findByVisitaIdIn(visitaIds).stream()
                .map(FeedbackDocument::getVisitaId)
                .collect(Collectors.toSet());

        List<String> semFeedback = encerradas.stream()
                .map(VisitaDocument::getId)
                .filter(id -> !comFeedback.contains(id))
                .toList();
        if (semFeedback.isEmpty()) {
            return;
        }
        // Update só do status, em vez de `saveAll` dos documentos lidos: regravar a visita
        // inteira podia devolver conta, aparelho ou pontos de GPS apagados no meio do caminho
        // pela retenção (DAD-01).
        mongoTemplate.updateMulti(
                new Query(Criteria.where("_id").in(semFeedback).and("status").is(StatusVisita.FINALIZADA)),
                new Update().set("status", StatusVisita.SEM_FEEDBACK),
                VisitaDocument.class);
    }

    @Override
    public long desvincularFeedbacksAntigos() {
        // Mesmo tratamento da exclusão de conta (M-041): o comentário é texto livre e pode
        // trazer nome, telefone ou o caso da pessoa, então sai junto com o vínculo.
        Query query = new Query(Criteria.where("criadoEm")
                .lt(Instant.now().minus(VisitaService.PRAZO_VINCULO_PESSOAL))
                .and("usuarioId").ne(null));
        Update update = new Update().set("usuarioId", null).set("anonimizado", true).unset("comentario");
        return mongoTemplate.updateMulti(query, update, FeedbackDocument.class).getModifiedCount();
    }

    /**
     * Busca a visita e garante que ela é de quem chama e aceita feedback: encerrada ({@code FINALIZADA} ou
     * {@code GPS_INTERROMPIDO}) e dentro da janela de 24h após a saída (RN-09). Fora disso
     * responde 404, o mesmo que a visita já marcada {@code SEM_FEEDBACK} pelo job recebe,
     * para o app tratar os dois casos como "não está mais disponível".
     */
    private VisitaDocument obterVisitaAvaliavel(String visitaId, String usuarioId, String dispositivoId) {
        VisitaDocument visita = visitaRepository.findById(visitaId)
                .orElseThrow(() -> new RecursoNaoEncontradoException(
                        "Visita não encontrada para o id informado."));
        // SEG-02: só quem fez a visita avalia. 403, como no BOLA de checkout (F-02). Vem
        // antes das regras de status e de janela para não contar a estranhos se a visita
        // está em andamento, encerrada ou já avaliada.
        if (!VisitaDono.isDonoDaVisita(visita, usuarioId, dispositivoId)) {
            throw new AcessoNegadoException("Visita não pertence ao usuário ou aparelho informado.");
        }
        if (!STATUS_AVALIAVEIS.contains(visita.getStatus())) {
            throw new RecursoNaoEncontradoException(
                    "O feedback só pode ser enviado após a visita ser encerrada.");
        }
        // Sem este corte, entre o fim da janela e a próxima passada do job (15 min) — e
        // sempre, para GPS_INTERROMPIDO, que o job não toca — a visita seguia avaliável.
        if (visita.getSaida() != null
                && Duration.between(visita.getSaida(), Instant.now()).compareTo(JANELA_RESPOSTA) > 0) {
            throw new RecursoNaoEncontradoException(
                    "A janela de 24 horas para avaliar esta visita já encerrou.");
        }
        return visita;
    }

    /**
     * Garante que o feedback pertence ao usuário autenticado (RN-13/RN-22).
     * Feedback anônimo ({@code usuarioId == null}) não tem dono autenticável: esses
     * endpoints exigem autenticação (🔒), portanto o acesso só é liberado quando o
     * feedback tem {@code usuarioId} igual ao do usuário logado.
     */
    private void exigirDono(FeedbackDocument feedback, String usuarioId) {
        // 403, não 401 (achado F-02 do pentest de 23/09/2026): quem chama já está
        // autenticado (endpoints 🔒) — só não é dono deste feedback (BOLA).
        if (usuarioId == null || feedback.getUsuarioId() == null
                || !feedback.getUsuarioId().equals(usuarioId)) {
            throw new AcessoNegadoException("Feedback não pertence ao usuário autenticado.");
        }
    }

    /** {@code motivoNaoAtendido} é obrigatório quando {@code foiAtendido = NAO} (RN-10). */
    private void validarMotivoNaoAtendido(FeedbackRequest request) {
        if (request.foiAtendido() == FoiAtendido.NAO
                && (request.motivoNaoAtendido() == null || request.motivoNaoAtendido().isBlank())) {
            throw new ValidacaoNegocioException(
                    "motivoNaoAtendido é obrigatório quando foiAtendido = NAO.");
        }
    }

    /** Normaliza o motivo textual do frontend (incl. label amigável) para a enum canônica (F-05). */
    private MotivoNaoAtendido normalizarMotivo(String motivo) {
        if (motivo == null || motivo.isBlank()) {
            return null;
        }
        if (motivo.equalsIgnoreCase(LABEL_CASOS_MAIS_GRAVES)) {
            return MotivoNaoAtendido.CLASSIFICACAO_RISCO;
        }
        try {
            return MotivoNaoAtendido.valueOf(motivo.toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ValidacaoNegocioException(
                    "motivoNaoAtendido inválido: " + motivo + ".");
        }
    }

    /**
     * Nomes dos hospitais em uma só consulta (sem N+1). Sem Collectors.toMap: ele lança
     * NPE com valor nulo, e hospital importado pode vir sem nome — um cadastro incompleto
     * não pode derrubar a lista inteira.
     */
    private Map<String, String> obterNomesHospitais(List<String> hospitalIds) {
        Map<String, String> nomes = new HashMap<>();
        List<String> distintos = hospitalIds.stream().filter(Objects::nonNull).distinct().toList();
        if (!distintos.isEmpty()) {
            for (HospitalDocument hospital : hospitalRepository.findAllById(distintos)) {
                nomes.putIfAbsent(hospital.getId(), hospital.getNome());
            }
        }
        return nomes;
    }

    private String obterNomeHospital(String hospitalId) {
        if (hospitalId == null) {
            return null;
        }
        return hospitalRepository.findById(hospitalId).map(HospitalDocument::getNome).orElse(null);
    }

    /**
     * Fim do prazo de edição (RN-09). Só a avaliação com dono é editável: a anônima, ou a
     * desvinculada da conta (DAD-01 B), não tem quem passe em {@link #exigirDono}.
     */
    private static Instant calcularEditavelAte(FeedbackDocument f) {
        if (f.getUsuarioId() == null || f.getCriadoEm() == null) {
            return null;
        }
        return f.getCriadoEm().plus(PRAZO_EDICAO);
    }

    private FeedbackResponse toResponse(FeedbackDocument f, String hospitalNome) {
        return new FeedbackResponse(
                f.getId(), f.getVisitaId(), f.getHospitalId(), hospitalNome,
                f.getFoiAtendido(), f.getMotivoNaoAtendido(), f.getTeveMedico(), f.getFezTriagem(),
                f.getMedicacaoReceita(), f.getEspecialidadeProcurada(), f.getNota(), f.getTratamentoEquipe(),
                f.getComentario(), f.isAnonimizado(), f.getCriadoEm(), calcularEditavelAte(f), true);
    }
}
