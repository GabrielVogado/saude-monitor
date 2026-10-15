package br.com.saude_monitor.api.feedback.seed;

import br.com.saude_monitor.api.feedback.document.FeedbackDocument;
import br.com.saude_monitor.api.feedback.document.FezTriagem;
import br.com.saude_monitor.api.feedback.document.FoiAtendido;
import br.com.saude_monitor.api.feedback.document.MedicacaoReceita;
import br.com.saude_monitor.api.feedback.document.MotivoNaoAtendido;
import br.com.saude_monitor.api.feedback.document.TeveMedico;
import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.visita.document.OrigemVisita;
import br.com.saude_monitor.api.visita.document.StatusVisita;
import br.com.saude_monitor.api.visita.document.TipoPermanencia;
import br.com.saude_monitor.api.visita.document.VisitaDocument;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Gera, sem tocar no banco, a massa de visitas e avaliações do ambiente de desenvolvimento.
 *
 * <p>Determinístico: a mesma semente, os mesmos hospitais e o mesmo {@code agora} produzem
 * a mesma massa. Cada hospital escolhido recebe um {@link Perfil} de qualidade que fixa a
 * distribuição das notas e do tempo de permanência, para o ranking (E4-05) ter diferenças
 * claras nas duas ordenações. Hospitais com {@link Perfil#POUCAS_AVALIACOES} ficam abaixo
 * do mínimo de 5 avaliações (RN-15) e o restante dos hospitais fica sem avaliação.</p>
 *
 * <p>As respostas seguem as regras do formulário (RN-10): especialidade e atendimento só
 * com triagem = Sim, motivo só com atendimento = Não, nota sempre presente (RN-11).</p>
 */
public final class MassaAvaliacoesGerador {

    /** Prefixo dos {@code _id} gerados — é por ele que a massa é encontrada e apagada. */
    public static final String PREFIXO_ID = "massa-dev-";

    static final String NOTA_AUDITORIA = "Massa de dados de desenvolvimento (avaliações)";

    /** Janela das datas geradas, dentro dos 90 dias dos indicadores (RN-14). */
    static final int DIAS_JANELA = 85;

    private static final ZoneOffset BRASILIA = ZoneOffset.ofHours(-3);

    /**
     * Perfil de qualidade de um hospital. {@code pesosNota[i]} é o peso da nota {@code i+1};
     * o tempo de permanência de cada visita sai de [{@code minutosMin}, {@code minutosMax}].
     */
    public enum Perfil {
        EXCELENTE(new int[]{1, 1, 4, 24, 70}, 25, 70, 10, 30),
        BOM(new int[]{3, 7, 20, 45, 25}, 50, 130, 8, 35),
        REGULAR(new int[]{10, 20, 40, 20, 10}, 100, 260, 6, 25),
        RUIM(new int[]{40, 30, 18, 8, 4}, 200, 600, 6, 20),
        POUCAS_AVALIACOES(new int[]{10, 15, 25, 30, 20}, 40, 240, 1, 4);

        final int[] pesosNota;
        final int minutosMin;
        final int minutosMax;
        final int avaliacoesMin;
        final int avaliacoesMax;

        Perfil(int[] pesosNota, int minutosMin, int minutosMax, int avaliacoesMin, int avaliacoesMax) {
            this.pesosNota = pesosNota;
            this.minutosMin = minutosMin;
            this.minutosMax = minutosMax;
            this.avaliacoesMin = avaliacoesMin;
            this.avaliacoesMax = avaliacoesMax;
        }
    }

    /** Quantos hospitais recebem cada perfil, na ordem em que são distribuídos. */
    static final Map<Perfil, Integer> HOSPITAIS_POR_PERFIL = ordenado(Map.of(
            Perfil.EXCELENTE, 10,
            Perfil.BOM, 14,
            Perfil.REGULAR, 12,
            Perfil.RUIM, 8,
            Perfil.POUCAS_AVALIACOES, 6));

    /** Mesma lista do formulário do app (Tela 2, RN-10). */
    static final List<String> ESPECIALIDADES = List.of(
            "Cardiologia", "Clínica médica", "Dermatologia", "Gastroenterologia",
            "Ginecologia e obstetrícia", "Infectologia", "Medicina de família e comunidade",
            "Medicina de urgência (emergência)", "Neurologia", "Oftalmologia",
            "Ortopedia e traumatologia", "Otorrinolaringologia", "Pediatria", "Pneumologia",
            "Pronto-socorro geral", "Psiquiatria", "Urologia");

    static final List<String> COMENTARIOS_POSITIVOS = List.of(
            "Fui atendido rápido e a equipe foi muito atenciosa.",
            "Triagem organizada, médico explicou tudo com calma.",
            "Unidade limpa e o atendimento foi melhor do que eu esperava.",
            "Esperei pouco. A enfermagem foi muito educada com minha mãe.",
            "Saí com a receita e as orientações certinhas. Recomendo.",
            "Atendimento humano, me senti acolhida.");

    static final List<String> COMENTARIOS_NEUTROS = List.of(
            "Demorou um pouco, mas fui atendido.",
            "Atendimento ok. A espera na recepção poderia ser menor.",
            "Médico bom, mas faltava informação sobre a ordem da fila.",
            "Nada de especial. Resolveu o que eu precisava.",
            "Sala de espera cheia, mas a equipe deu conta.");

    static final List<String> COMENTARIOS_NEGATIVOS = List.of(
            "Esperei mais de 6 horas e não tinha médico da especialidade.",
            "Recepção desorganizada, ninguém sabia informar nada.",
            "Fui embora sem atendimento depois de horas na fila.",
            "Faltava médico e a sala de espera estava lotada.",
            "Banheiros sujos e ar-condicionado quebrado.",
            "Me mandaram voltar outro dia. Muito difícil conseguir atendimento.");

    /** Resultado da geração: o que gravar e o perfil sorteado para cada hospital. */
    public record Massa(
            List<VisitaDocument> visitas,
            List<FeedbackDocument> feedbacks,
            Map<String, Perfil> perfilPorHospital) {
    }

    private final Random random;
    private final Instant agora;
    private int sequencial;

    public MassaAvaliacoesGerador(long semente, Instant agora) {
        this.random = new Random(semente);
        this.agora = agora;
    }

    /**
     * Gera a massa para os hospitais e usuários informados.
     *
     * @param hospitais  hospitais ativos candidatos (só {@code id} e {@code categoria} são usados)
     * @param usuarioIds usuários de teste donos das avaliações identificadas; as demais
     *                   (cerca de 15%) são anônimas (RN-13)
     */
    public Massa gerar(List<HospitalDocument> hospitais, List<String> usuarioIds) {
        Map<String, Perfil> perfis = distribuirPerfis(hospitais);
        List<VisitaDocument> visitas = new ArrayList<>();
        List<FeedbackDocument> feedbacks = new ArrayList<>();

        perfis.forEach((hospitalId, perfil) -> {
            int avaliacoes = entre(perfil.avaliacoesMin, perfil.avaliacoesMax);
            for (int i = 0; i < avaliacoes; i++) {
                String usuarioId = usuarioIds.isEmpty() || random.nextInt(100) < 15
                        ? null
                        : usuarioIds.get(random.nextInt(usuarioIds.size()));
                VisitaDocument visita = visita(hospitalId, perfil, usuarioId, TipoPermanencia.ATENDIMENTO);
                visitas.add(visita);
                feedbacks.add(feedback(visita, perfil));
            }
            // Visitas que não entram no tempo mediano (RN-16/RN-24): internação/observação
            // avaliada e visita sem resposta de feedback (RN-09).
            if (perfil != Perfil.POUCAS_AVALIACOES) {
                String usuarioId = usuarioIds.isEmpty() ? null : usuarioIds.get(random.nextInt(usuarioIds.size()));
                VisitaDocument internacao = visita(hospitalId, perfil, usuarioId,
                        random.nextBoolean() ? TipoPermanencia.INTERNACAO : TipoPermanencia.OBSERVACAO);
                internacao.setDuracaoMinutos(entre(12 * 60, 23 * 60));
                internacao.setSaida(internacao.getEntrada().plus(Duration.ofMinutes(internacao.getDuracaoMinutos())));
                ajustarFechamento(internacao);
                visitas.add(internacao);
                feedbacks.add(feedback(internacao, perfil));

                VisitaDocument semResposta = visita(hospitalId, perfil, usuarioId, TipoPermanencia.ATENDIMENTO);
                semResposta.setStatus(StatusVisita.SEM_FEEDBACK);
                visitas.add(semResposta);
            }
        });
        return new Massa(visitas, feedbacks, perfis);
    }

    /**
     * Sorteia os hospitais de cada perfil alternando as categorias (hospital, UPA, UBS...),
     * para o ranking ter variedade de tipos e não só a categoria mais numerosa.
     */
    Map<String, Perfil> distribuirPerfis(List<HospitalDocument> hospitais) {
        Map<CategoriaEstabelecimento, List<HospitalDocument>> porCategoria = new EnumMap<>(CategoriaEstabelecimento.class);
        hospitais.stream()
                .sorted(Comparator.comparing(HospitalDocument::getId))
                .forEach(h -> porCategoria
                        .computeIfAbsent(h.getCategoria() == null ? CategoriaEstabelecimento.OUTRO : h.getCategoria(),
                                c -> new ArrayList<>())
                        .add(h));
        porCategoria.values().forEach(lista -> Collections.shuffle(lista, random));

        List<HospitalDocument> intercalados = new ArrayList<>();
        boolean restou = true;
        for (int i = 0; restou; i++) {
            restou = false;
            for (List<HospitalDocument> lista : porCategoria.values()) {
                if (i < lista.size()) {
                    intercalados.add(lista.get(i));
                    restou = true;
                }
            }
        }

        List<Perfil> fila = new ArrayList<>();
        HOSPITAIS_POR_PERFIL.forEach((perfil, quantidade) -> {
            for (int i = 0; i < quantidade; i++) {
                fila.add(perfil);
            }
        });
        Collections.shuffle(fila, random);

        Map<String, Perfil> perfis = new LinkedHashMap<>();
        for (int i = 0; i < fila.size() && i < intercalados.size(); i++) {
            perfis.put(intercalados.get(i).getId(), fila.get(i));
        }
        return perfis;
    }

    private VisitaDocument visita(String hospitalId, Perfil perfil, String usuarioId, TipoPermanencia tipo) {
        int duracao = entre(perfil.minutosMin, perfil.minutosMax);
        // Entrada entre 2 e DIAS_JANELA dias atrás (a saída nunca passa de agora), entre 6h e 21h59 no horário de Brasília.
        Instant entrada = agora.atOffset(BRASILIA)
                .minusDays(entre(2, DIAS_JANELA))
                .truncatedTo(ChronoUnit.DAYS)
                .plusMinutes(entre(6 * 60, 22 * 60 - 1))
                .toInstant();
        String id = proximoId("visita");
        VisitaDocument visita = VisitaDocument.builder()
                .id(id)
                .usuarioId(usuarioId)
                .dispositivoId(usuarioId == null ? PREFIXO_ID + "dispositivo-" + entre(1, 40) : null)
                .hospitalId(hospitalId)
                .entrada(entrada)
                .saida(entrada.plus(Duration.ofMinutes(duracao)))
                .duracaoMinutos(duracao)
                .status(StatusVisita.FINALIZADA)
                .tipoPermanencia(tipo)
                .origem(random.nextInt(100) < 80 ? OrigemVisita.GEOFENCE : OrigemVisita.MANUAL)
                .notas(NOTA_AUDITORIA)
                .criadoEm(entrada)
                .build();
        ajustarFechamento(visita);
        return visita;
    }

    /** Heartbeat, última posição e momento de processamento acompanham a saída. */
    private static void ajustarFechamento(VisitaDocument visita) {
        visita.setUltimoHeartbeat(visita.getSaida());
        visita.setUltimaPosicaoEm(visita.getSaida());
        visita.setProcessadoEm(visita.getSaida());
    }

    private FeedbackDocument feedback(VisitaDocument visita, Perfil perfil) {
        int nota = sortearNota(perfil.pesosNota);
        FezTriagem triagem = escolher(new int[]{70, 20, 10}, FezTriagem.values());

        String especialidade = null;
        FoiAtendido atendido = null;
        MotivoNaoAtendido motivo = null;
        if (triagem == FezTriagem.SIM) {
            especialidade = ESPECIALIDADES.get(random.nextInt(ESPECIALIDADES.size()));
            int[] pesosAtendido = nota >= 4 ? new int[]{90, 7, 3}
                    : nota == 3 ? new int[]{70, 20, 10}
                    : new int[]{40, 35, 25};
            atendido = escolher(pesosAtendido, FoiAtendido.values());
            if (atendido == FoiAtendido.NAO) {
                motivo = nota <= 2
                        ? escolher(new int[]{45, 35, 10, 10}, MotivoNaoAtendido.values())
                        : escolher(new int[]{20, 25, 45, 10}, MotivoNaoAtendido.values());
            }
        }

        TeveMedico teveMedico;
        if (atendido == FoiAtendido.SIM) {
            teveMedico = TeveMedico.SIM;
        } else if (atendido != null) {
            teveMedico = TeveMedico.NAO;
        } else {
            teveMedico = escolher(new int[]{60, 15, 25}, TeveMedico.values());
        }

        // Sem médico não há receita: evita "não teve médico" com "recebeu medicação".
        MedicacaoReceita medicacao = teveMedico != TeveMedico.SIM
                ? MedicacaoReceita.NAO_RECEBEU
                : escolher(new int[]{55, 15, 30}, MedicacaoReceita.values());

        Integer tratamentoEquipe = random.nextInt(100) < 80
                ? Math.clamp((long) nota + random.nextInt(3) - 1, 1, 5)
                : null;

        String comentario = null;
        if (random.nextInt(100) < 45) {
            List<String> pool = nota >= 4 ? COMENTARIOS_POSITIVOS
                    : nota == 3 ? COMENTARIOS_NEUTROS
                    : COMENTARIOS_NEGATIVOS;
            comentario = pool.get(random.nextInt(pool.size()));
        }

        Instant criadoEm = visita.getSaida().plus(Duration.ofMinutes(entre(1, 30)));
        return FeedbackDocument.builder()
                .id(proximoId("feedback"))
                .visitaId(visita.getId())
                .usuarioId(visita.getUsuarioId())
                .hospitalId(visita.getHospitalId())
                .especialidadeProcurada(especialidade)
                .foiAtendido(atendido)
                .motivoNaoAtendido(motivo)
                .teveMedico(teveMedico)
                .fezTriagem(triagem)
                .medicacaoReceita(medicacao)
                .nota(nota)
                .tratamentoEquipe(tratamentoEquipe)
                .comentario(comentario)
                .anonimizado(visita.getUsuarioId() == null)
                .criadoEm(criadoEm.isAfter(agora) ? agora : criadoEm)
                .build();
    }

    private int sortearNota(int[] pesos) {
        Integer[] notas = {1, 2, 3, 4, 5};
        return escolher(pesos, notas);
    }

    private <T> T escolher(int[] pesos, T[] valores) {
        int total = 0;
        for (int peso : pesos) {
            total += peso;
        }
        int sorteio = random.nextInt(total);
        for (int i = 0; i < pesos.length; i++) {
            sorteio -= pesos[i];
            if (sorteio < 0) {
                return valores[i];
            }
        }
        return valores[valores.length - 1];
    }

    private int entre(int min, int max) {
        return min + random.nextInt(max - min + 1);
    }

    private String proximoId(String tipo) {
        sequencial++;
        return "%s%s-%05d".formatted(PREFIXO_ID, tipo, sequencial);
    }

    private static Map<Perfil, Integer> ordenado(Map<Perfil, Integer> origem) {
        Map<Perfil, Integer> ordenado = new EnumMap<>(Perfil.class);
        ordenado.putAll(origem);
        return Collections.unmodifiableMap(ordenado);
    }
}
