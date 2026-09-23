package br.com.saude_monitor.api.user.service.impl;

import br.com.saude_monitor.api.feedback.document.FeedbackDocument;
import br.com.saude_monitor.api.user.document.ConsentimentoItem;
import br.com.saude_monitor.api.user.document.ConsentimentosDocument;
import br.com.saude_monitor.api.user.service.ExportacaoPdfService;
import br.com.saude_monitor.api.visita.document.VisitaDocument;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Geração do relatório PDF de dados pessoais do titular (E5-03 / art. 18 LGPD).
 *
 * <p>O PDF é a via <strong>acessível ao cidadão</strong> do direito de portabilidade:
 * o mesmo conteúdo do JSON ({@code GET /api/v1/contas/export}), porém em linguagem e
 * formato legíveis sem ferramenta técnica.</p>
 *
 * <p>Datas são apresentadas no fuso de Brasília, coerente com o restante do produto.</p>
 */
@Slf4j
@Service
public class ExportacaoPdfServiceImpl implements ExportacaoPdfService {

    private static final ZoneId FUSO_BRASILIA = ZoneId.of("America/Sao_Paulo");

    private static final DateTimeFormatter DATA_HORA =
            DateTimeFormatter.ofPattern("dd/MM/yyyy 'às' HH:mm").withZone(FUSO_BRASILIA);

    private static final Color VERDE_TITULO = new Color(0x0B, 0x6B, 0x53);

    private static final String SEM_INFORMACAO = "—";

    @Override
    public byte[] gerar(Map<String, Object> dados) {
        Document documento = new Document(PageSize.A4, 42, 42, 48, 48);
        ByteArrayOutputStream saida = new ByteArrayOutputStream();

        PdfWriter.getInstance(documento, saida);
        documento.addTitle("Relatório de dados pessoais");
        documento.open();

        try {
            escreverCabecalho(documento, dados);
            escreverPerfil(documento, mapa(dados.get("usuario")));
            escreverConsentimentos(documento, mapa(dados.get("usuario")).get("consentimentos"));
            escreverVisitas(documento, lista(dados.get("visitas")));
            escreverFeedbacks(documento, lista(dados.get("feedbacks")));
            escreverRodape(documento);
        } finally {
            documento.close();
        }

        return saida.toByteArray();
    }

    private void escreverCabecalho(Document documento, Map<String, Object> dados) {
        Paragraph titulo = new Paragraph("Relatório de dados pessoais",
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, VERDE_TITULO));
        titulo.setSpacingAfter(4);
        documento.add(titulo);

        Paragraph subtitulo = new Paragraph(
                "Clinical Sanctuary — monitoramento hospitalar por geolocalização",
                fonte(10, Color.DARK_GRAY));
        subtitulo.setSpacingAfter(12);
        documento.add(subtitulo);

        Paragraph explicacao = new Paragraph(
                "Este documento reúne todos os dados pessoais que mantemos sobre você, "
                        + "conforme o direito de acesso e portabilidade previsto no art. 18 da "
                        + "Lei Geral de Proteção de Dados (Lei 13.709/2018).",
                fonte(10, Color.BLACK));
        explicacao.setSpacingAfter(6);
        documento.add(explicacao);

        documento.add(new Paragraph("Gerado em " + formatarInstante(dados.get("geradoEm")) + ".",
                fonte(9, Color.DARK_GRAY)));
    }

    private void escreverPerfil(Document documento, Map<String, Object> usuario) {
        documento.add(secao("1. Seus dados de cadastro"));

        PdfPTable tabela = tabela(new float[]{1f, 2f});
        linha(tabela, "Nome", texto(usuario.get("nome")));
        linha(tabela, "E-mail", texto(usuario.get("email")));
        linha(tabela, "Telefone", texto(usuario.get("telefone")));
        linha(tabela, "Conta criada em", formatarInstante(usuario.get("criadoEm")));
        documento.add(tabela);
    }

    private void escreverConsentimentos(Document documento, Object consentimentos) {
        documento.add(secao("2. Consentimentos registrados"));

        if (!(consentimentos instanceof ConsentimentosDocument registro)) {
            documento.add(new Paragraph("Nenhum consentimento registrado.", fonte(10, Color.BLACK)));
            return;
        }

        PdfPTable tabela = tabela(new float[]{1.4f, 0.8f, 1.2f, 0.8f});
        cabecalho(tabela, "Finalidade", "Situação", "Data", "Versão");
        linhaConsentimento(tabela, "Localização", registro.getLocalizacao());
        linhaConsentimento(tabela, "Notificações", registro.getNotificacoes());
        linhaConsentimento(tabela, "Termos de uso", registro.getTermosUso());
        documento.add(tabela);
    }

    private void escreverVisitas(Document documento, List<?> visitas) {
        documento.add(secao("3. Suas visitas a hospitais (" + visitas.size() + ")"));

        if (visitas.isEmpty()) {
            documento.add(new Paragraph("Nenhuma visita registrada.", fonte(10, Color.BLACK)));
            return;
        }

        PdfPTable tabela = tabela(new float[]{1.4f, 1.4f, 0.9f, 1f, 0.9f});
        cabecalho(tabela, "Entrada", "Saída", "Duração", "Situação", "Origem");

        for (Object item : visitas) {
            if (!(item instanceof VisitaDocument visita)) {
                continue;
            }
            celula(tabela, formatarInstante(visita.getEntrada()));
            celula(tabela, formatarInstante(visita.getSaida()));
            celula(tabela, formatarDuracao(visita.getDuracaoMinutos()));
            celula(tabela, texto(visita.getStatus()));
            celula(tabela, texto(visita.getOrigem()));
        }

        documento.add(tabela);
    }

    private void escreverFeedbacks(Document documento, List<?> feedbacks) {
        documento.add(secao("4. Suas avaliações (" + feedbacks.size() + ")"));

        if (feedbacks.isEmpty()) {
            documento.add(new Paragraph("Nenhuma avaliação registrada.", fonte(10, Color.BLACK)));
            return;
        }

        PdfPTable tabela = tabela(new float[]{1.2f, 0.6f, 1f, 2.2f});
        cabecalho(tabela, "Data", "Nota", "Foi atendido", "Comentário");

        for (Object item : feedbacks) {
            if (!(item instanceof FeedbackDocument feedback)) {
                continue;
            }
            celula(tabela, formatarInstante(feedback.getCriadoEm()));
            celula(tabela, texto(feedback.getNota()));
            celula(tabela, texto(feedback.getFoiAtendido()));
            celula(tabela, texto(feedback.getComentario()));
        }

        documento.add(tabela);
    }

    private void escreverRodape(Document documento) {
        Paragraph rodape = new Paragraph(
                "Para corrigir, anonimizar ou excluir estes dados, use Perfil → Dados e "
                        + "Privacidade no aplicativo, ou entre em contato pelo suporte. "
                        + "Responderemos em até 15 dias úteis.",
                fonte(9, Color.DARK_GRAY));
        rodape.setSpacingBefore(18);
        documento.add(rodape);
    }

    // ------------------------------------------------------------------
    // Helpers de layout
    // ------------------------------------------------------------------

    private Paragraph secao(String titulo) {
        Paragraph paragrafo = new Paragraph(titulo,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, VERDE_TITULO));
        paragrafo.setSpacingBefore(18);
        paragrafo.setSpacingAfter(8);
        return paragrafo;
    }

    private PdfPTable tabela(float[] larguras) {
        PdfPTable tabela = new PdfPTable(larguras);
        tabela.setWidthPercentage(100);
        tabela.setSpacingBefore(4);
        return tabela;
    }

    private void cabecalho(PdfPTable tabela, String... titulos) {
        for (String titulo : titulos) {
            PdfPCell celula = new PdfPCell(new Phrase(titulo,
                    FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE)));
            celula.setBackgroundColor(VERDE_TITULO);
            celula.setPadding(6);
            tabela.addCell(celula);
        }
    }

    private void linha(PdfPTable tabela, String rotulo, String valor) {
        PdfPCell celulaRotulo = new PdfPCell(new Phrase(rotulo,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.BLACK)));
        celulaRotulo.setPadding(6);
        tabela.addCell(celulaRotulo);
        celula(tabela, valor);
    }

    private void linhaConsentimento(PdfPTable tabela, String finalidade, ConsentimentoItem item) {
        celula(tabela, finalidade);
        celula(tabela, item == null ? SEM_INFORMACAO : (item.isAceito() ? "Concedido" : "Revogado"));
        celula(tabela, item == null ? SEM_INFORMACAO : formatarInstante(item.getData()));
        celula(tabela, item == null ? SEM_INFORMACAO : texto(item.getVersao()));
    }

    private void celula(PdfPTable tabela, String valor) {
        PdfPCell celula = new PdfPCell(new Phrase(valor, fonte(9, Color.BLACK)));
        celula.setPadding(6);
        celula.setVerticalAlignment(Element.ALIGN_MIDDLE);
        tabela.addCell(celula);
    }

    private Font fonte(int tamanho, Color cor) {
        return FontFactory.getFont(FontFactory.HELVETICA, tamanho, cor);
    }

    // ------------------------------------------------------------------
    // Helpers de dados
    // ------------------------------------------------------------------

    @SuppressWarnings("unchecked")
    private Map<String, Object> mapa(Object valor) {
        return valor instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
    }

    private List<?> lista(Object valor) {
        return valor instanceof Collection<?> c ? List.copyOf(c) : List.of();
    }

    private String texto(Object valor) {
        if (valor == null) {
            return SEM_INFORMACAO;
        }
        String texto = String.valueOf(valor).trim();
        return texto.isEmpty() ? SEM_INFORMACAO : texto;
    }

    private String formatarInstante(Object valor) {
        if (valor instanceof Instant instante) {
            return DATA_HORA.format(instante);
        }
        if (valor instanceof CharSequence sequencia) {
            try {
                return DATA_HORA.format(Instant.parse(sequencia));
            } catch (RuntimeException ignorado) {
                return sequencia.toString();
            }
        }
        return SEM_INFORMACAO;
    }

    private String formatarDuracao(Object minutos) {
        if (!(minutos instanceof Number numero)) {
            return SEM_INFORMACAO;
        }
        int total = Math.max(0, numero.intValue());
        int horas = total / 60;
        int resto = total % 60;
        return horas == 0 ? resto + " min" : "%dh%02d".formatted(horas, resto);
    }
}
