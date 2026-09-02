package br.com.saude_monitor.api.user.service.impl;

import br.com.saude_monitor.api.feedback.document.FeedbackDocument;
import br.com.saude_monitor.api.user.document.ConsentimentoItem;
import br.com.saude_monitor.api.user.document.ConsentimentosDocument;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Testes do relatório PDF de exportação de dados do titular (E5-03 / art. 18 LGPD).
 *
 * <p>Verificam que o documento é um PDF válido e que o serviço tolera os cenários
 * reais do agregado: titular sem visitas/feedbacks, campos nulos e consentimentos
 * ausentes — nenhum deles pode impedir o cidadão de exercer o direito de acesso.</p>
 */
class ExportacaoPdfServiceImplTest {

    private final ExportacaoPdfServiceImpl service = new ExportacaoPdfServiceImpl();

    private Map<String, Object> dadosCompletos() {
        ConsentimentosDocument consentimentos = ConsentimentosDocument.builder()
                .localizacao(new ConsentimentoItem(true, Instant.parse("2026-08-01T12:00:00Z"), "1.0"))
                .notificacoes(new ConsentimentoItem(false, Instant.parse("2026-08-20T12:00:00Z"), "1.0"))
                .termosUso(new ConsentimentoItem(true, Instant.parse("2026-08-01T12:00:00Z"), "1.0"))
                .build();

        VisitaDocument visita = new VisitaDocument();
        visita.setId("v1");
        visita.setEntrada(Instant.parse("2026-08-10T13:00:00Z"));
        visita.setSaida(Instant.parse("2026-08-10T15:30:00Z"));
        visita.setDuracaoMinutos(150);

        FeedbackDocument feedback = new FeedbackDocument();
        feedback.setId("f1");
        feedback.setNota(5);
        feedback.setComentario("Atendimento rápido.");
        feedback.setCriadoEm(Instant.parse("2026-08-10T16:00:00Z"));

        Map<String, Object> usuario = new LinkedHashMap<>();
        usuario.put("nome", "Marina Souza");
        usuario.put("email", "marina@email.com");
        usuario.put("telefone", "(61) 99999-0000");
        usuario.put("criadoEm", Instant.parse("2026-08-01T12:00:00Z"));
        usuario.put("consentimentos", consentimentos);

        Map<String, Object> dados = new LinkedHashMap<>();
        dados.put("geradoEm", Instant.parse("2026-09-01T10:00:00Z"));
        dados.put("usuario", usuario);
        dados.put("visitas", List.of(visita));
        dados.put("feedbacks", List.of(feedback));
        return dados;
    }

    @Test
    void deveGerarPdfValido() {
        byte[] pdf = service.gerar(dadosCompletos());

        assertThat(pdf).isNotEmpty();
        assertThat(new String(pdf, 0, 5, StandardCharsets.ISO_8859_1)).isEqualTo("%PDF-");
    }

    @Test
    void deveGerarPdfParaTitularSemVisitasNemFeedbacks() {
        Map<String, Object> dados = dadosCompletos();
        dados.put("visitas", List.of());
        dados.put("feedbacks", List.of());

        byte[] pdf = service.gerar(dados);

        assertThat(pdf).isNotEmpty();
        assertThat(new String(pdf, 0, 5, StandardCharsets.ISO_8859_1)).isEqualTo("%PDF-");
    }

    @Test
    void deveGerarPdfMesmoSemConsentimentosRegistrados() {
        Map<String, Object> dados = dadosCompletos();
        Map<String, Object> usuario = new LinkedHashMap<>();
        usuario.put("nome", "Marina Souza");
        usuario.put("email", "marina@email.com");
        usuario.put("telefone", "");
        dados.put("usuario", usuario);

        byte[] pdf = service.gerar(dados);

        assertThat(pdf).isNotEmpty();
    }

    @Test
    void naoDeveQuebrarComAgregadoVazio() {
        byte[] pdf = service.gerar(Map.of());

        assertThat(pdf).isNotEmpty();
        assertThat(new String(pdf, 0, 5, StandardCharsets.ISO_8859_1)).isEqualTo("%PDF-");
    }
}
