package br.com.saude_monitor.api.feedback.service.impl;

import br.com.saude_monitor.api.agregado.event.FeedbackSalvoEvent;
import br.com.saude_monitor.api.config.exception.ConflitoException;
import br.com.saude_monitor.api.config.exception.NaoAutorizadoException;
import br.com.saude_monitor.api.config.exception.RecursoNaoEncontradoException;
import br.com.saude_monitor.api.config.exception.ValidacaoNegocioException;
import br.com.saude_monitor.api.feedback.document.FeedbackDocument;
import br.com.saude_monitor.api.feedback.document.FoiAtendido;
import br.com.saude_monitor.api.feedback.document.MotivoNaoAtendido;
import br.com.saude_monitor.api.feedback.dto.FeedbackRequest;
import br.com.saude_monitor.api.feedback.dto.FeedbackResponse;
import br.com.saude_monitor.api.feedback.repository.FeedbackRepository;
import br.com.saude_monitor.api.feedback.service.FeedbackService;
import br.com.saude_monitor.api.visita.document.StatusVisita;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import br.com.saude_monitor.api.visita.repository.VisitaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Implementação do serviço de feedback pós-saída (Épico 03 / F-05).
 *
 * <p>Regras aplicadas: dedupe 1 feedback por visita (RN-12, via {@code visitaId} único);
 * feedback anônimo sem {@code usuarioId} (RN-13); a visita deve estar {@code FINALIZADA}
 * (não é possível avaliar visita em andamento); janela de 24h para edição (RN-09);
 * {@code motivoNaoAtendido} obrigatório quando {@code foiAtendido = NAO} (RN-10).</p>
 */
@Service
@RequiredArgsConstructor
public class FeedbackServiceImpl implements FeedbackService {

    /** Janela de 24h para responder/editar o feedback após a saída (RN-09). */
    private static final Duration JANELA_RESPOSTA = Duration.ofHours(24);

    /** Label amigável enviado pelo frontend (F-05); o backend normaliza para CLASSIFICACAO_RISCO. */
    private static final String LABEL_CASOS_MAIS_GRAVES = "CASOS_MAIS_GRAVES_PRIORIDADE";

    private final FeedbackRepository feedbackRepository;
    private final VisitaRepository visitaRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    public FeedbackResponse criar(FeedbackRequest request, String usuarioId) {
        VisitaDocument visita = obterVisitaFinalizada(request.visitaId());

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

        FeedbackDocument salvo = feedbackRepository.save(feedback);

        // Dispara o recálculo assíncrono do agregado do hospital (Épico 04, RN-18).
        // AFTER_COMMIT no listener garante que só recalcula depois do commit desta transação.
        eventPublisher.publishEvent(new FeedbackSalvoEvent(salvo.getHospitalId()));

        return toResponse(salvo, true);
    }

    @Override
    public Optional<FeedbackResponse> buscarPorVisita(String visitaId, String usuarioId) {
        FeedbackDocument feedback = feedbackRepository.findByVisitaId(visitaId).orElse(null);
        if (feedback == null) {
            return Optional.empty();
        }
        exigirDono(feedback, usuarioId);
        return Optional.of(toResponse(feedback, true));
    }

    @Override
    public FeedbackResponse atualizar(String id, FeedbackRequest request, String usuarioId) {
        FeedbackDocument feedback = feedbackRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Feedback não encontrado para o id informado."));
        exigirDono(feedback, usuarioId);

        if (Duration.between(feedback.getCriadoEm(), Instant.now()).compareTo(JANELA_RESPOSTA) > 0) {
            throw new ConflitoException("A janela de 24 horas para editar este feedback já encerrou.");
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

        FeedbackDocument salvo = feedbackRepository.save(feedback);

        // Edição dentro da janela de 24h pode alterar a nota — recalcula o agregado (RN-18).
        eventPublisher.publishEvent(new FeedbackSalvoEvent(salvo.getHospitalId()));

        return toResponse(salvo, true);
    }

    @Override
    public void processarSemResposta() {
        Instant limite = Instant.now().minus(JANELA_RESPOSTA);
        List<VisitaDocument> encerradas = visitaRepository
                .findByStatusAndSaidaBefore(StatusVisita.FINALIZADA, limite);

        for (VisitaDocument visita : encerradas) {
            if (feedbackRepository.existsByVisitaId(visita.getId())) {
                continue;
            }
            visita.setStatus(StatusVisita.SEM_FEEDBACK);
        }
        visitaRepository.saveAll(encerradas);
    }

    /** Busca a visita e garante que está {@code FINALIZADA} (não é possível avaliar visita em andamento/expirada). */
    private VisitaDocument obterVisitaFinalizada(String visitaId) {
        VisitaDocument visita = visitaRepository.findById(visitaId)
                .orElseThrow(() -> new RecursoNaoEncontradoException(
                        "Visita não encontrada para o id informado."));
        if (visita.getStatus() != StatusVisita.FINALIZADA) {
            throw new RecursoNaoEncontradoException(
                    "O feedback só pode ser enviado após a visita ser encerrada (status FINALIZADA).");
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
        if (usuarioId == null || feedback.getUsuarioId() == null
                || !feedback.getUsuarioId().equals(usuarioId)) {
            throw new NaoAutorizadoException("Feedback não pertence ao usuário autenticado.");
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

    private FeedbackResponse toResponse(FeedbackDocument f, boolean recebido) {
        return new FeedbackResponse(
                f.getId(), f.getVisitaId(), f.getHospitalId(),
                f.getFoiAtendido(), f.getMotivoNaoAtendido(), f.getTeveMedico(), f.getFezTriagem(),
                f.getMedicacaoReceita(), f.getEspecialidadeProcurada(), f.getNota(), f.getTratamentoEquipe(),
                f.getComentario(), f.isAnonimizado(), f.getCriadoEm(), recebido);
    }
}
