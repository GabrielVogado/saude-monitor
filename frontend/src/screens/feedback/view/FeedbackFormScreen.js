import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Star } from "lucide-react-native";
import CSChip from "../../../components/CSChip";
import CSButton from "../../../components/CSButton";
import CSTextField from "../../../components/CSTextField";
import { colors, radii, spacing, typography } from "../../../theme/tokens";
import FeedbackService from "../service/FeedbackService";
import { concluirFeedback } from "../service/FeedbackNotificationService";

/**
 * Formulário de feedback pós-saída (Épico 03 — F-05/E3-02).
 *
 * Fluxo de 4 telas ramificado (RN-10/RN-11), otimizado para <45s e pulável (RN-11):
 *   1. Triagem (fezTriagem). Responder "Não"/"Não sei" PULA a Tela 2 (especialidade + atendimento).
 *   2. Especialidade (select searchable — RN-10) + Atendimento (foiAtendido / teveMedico /
 *      motivoNaoAtendido se NAO)
 *   3. Medicamento/Receita + Tratamento da equipe (medicacaoReceita / tratamentoEquipe 1-5 +
 *      "Não interagi", que zera a estrela)
 *   4. Avaliação geral (nota 1-5 obrigatória + comentário opcional)
 *
 * Todas as perguntas, exceto a `nota`, podem ser puladas. Submit dispara POST
 * (criação) ou PUT (edição — janela de 24h, RN-09).
 */

const OPCOES_SIM_NAO = ["SIM", "NAO", "NAO_SEI"];

/**
 * Lista curada de especialidades para o select searchable da Tela 2 (RN-10).
 * Base referencial CNES/DATASUS/TABNET — aproximação local, sem dataset completo no app.
 */
const ESPECIALIDADES = [
  "Acupuntura",
  "Anestesiologia",
  "Cardiologia",
  "Clínica médica",
  "Dermatologia",
  "Endocrinologia e metabologia",
  "Gastroenterologia",
  "Geriatria",
  "Ginecologia e obstetrícia",
  "Infectologia",
  "Medicina de família e comunidade",
  "Medicina de urgência (emergência)",
  "Nefrologia",
  "Neurologia",
  "Nutrição",
  "Oftalmologia",
  "Ortopedia e traumatologia",
  "Otorrinolaringologia",
  "Pediatria",
  "Pneumologia",
  "Pronto-socorro geral",
  "Psicologia",
  "Psiquiatria",
  "Urologia",
];

/** Normaliza para busca insensível a acentos/maiúsculas/minúsculas. */
function normalizar(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const ROTULOS_TRATAMENTO = ["Ruim", "Regular", "Bom", "Muito bom", "Excelente"];

const OpcoesFezTriagem = ({ valor, aoSelecionar, rotulo, opcoes = OPCOES_SIM_NAO }) => (
  <View style={styles.opcoes}>
    {opcoes.map((opcao) => (
      <CSChip
        key={opcao}
        label={rotulo(opcao)}
        selected={valor === opcao}
        onPress={() => aoSelecionar(valor === opcao ? null : opcao)}
      />
    ))}
  </View>
);

/** Estrelas interativas para `nota` e `tratamentoEquipe` (1–5). */
function Estrelas({ valor, aoSelecionar, tamanho = 36, testIDPrefix = "star" }) {
  return (
    <View style={styles.estrelas} accessibilityRole="adjustable" accessibilityLabel="Avaliação por estrelas">
      {[1, 2, 3, 4, 5].map((nota) => (
        <Pressable
          key={nota}
          testID={`${testIDPrefix}-${nota}`}
          accessibilityRole="button"
          accessibilityLabel={`Nota ${nota}`}
          onPress={() => aoSelecionar(nota)}
          hitSlop={8}
          style={styles.estrelaBotao}
        >
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Star
              size={tamanho}
              color={nota <= (valor || 0) ? colors.ratingFilled : colors.ratingEmpty}
              fill={nota <= (valor || 0) ? colors.ratingFilled : "transparent"}
            />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const rotulos = {
  foiAtendido: { SIM: "Fui atendido", NAO: "Não fui atendido" },
  teveMedico: { SIM: "Sim", NAO: "Não", NAO_PRECISEI: "Não precisei" },
  fezTriagem: { SIM: "Sim", NAO: "Não", NAO_SEI: "Não sei" },
  medicacaoReceita: { RECEBI: "Recebi", NAO_RECEBEU: "Não recebi", NAO_PRECISEI: "Não precisei" },
  motivoNaoAtendido: {
    FALTA_MEDICO: "Falta de médico",
    LOTACAO: "Hospital lotado",
    CLASSIFICACAO_RISCO: "Casos mais graves têm prioridade",
    OUTRO: "Outro motivo",
  },
};

const ETAPAS = [
  { chave: "triagem", titulo: "Você passou pela triagem?", descricao: "Se não lembrar, pode pular." },
  {
    chave: "atendimento",
    titulo: "Sobre o atendimento",
    descricao: "Fale brevemente sobre a especialidade e o atendimento que recebeu.",
  },
  {
    chave: "medicamento",
    titulo: "Medicamentos e equipe",
    descricao: "Essas informações ajudam a melhorar o fluxo de atendimento.",
  },
  { chave: "avaliacao", titulo: "Avaliação geral", descricao: "Dê uma nota de 1 a 5 para sua visita." },
];

export default function FeedbackFormScreen({ navigation, route }) {
  const { visitaId, hospitalNome, feedbackId } = route.params || {};

  const [etapa, setEtapa] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState(null);
  const [jaAvaliado, setJaAvaliado] = useState(false);
  const [naoInteragi, setNaoInteragi] = useState(false);

  const [form, setForm] = useState({
    fezTriagem: null,
    especialidadeProcurada: "",
    foiAtendido: null,
    teveMedico: null,
    motivoNaoAtendido: null,
    medicacaoReceita: null,
    tratamentoEquipe: null,
    nota: null,
    comentario: "",
  });

  // RN-11: a Tela 2 (especialidade + atendimento) só aparece quando triagem = Sim.
  // Sem triagem o fluxo vai direto da Tela 1 para a Tela 3.
  const etapasDaVez = useMemo(() => {
    if (form.fezTriagem === "SIM") return ETAPAS;
    return ETAPAS.filter((item) => item.chave !== "atendimento");
  }, [form.fezTriagem]);

  const passo = etapasDaVez[etapa];
  const ultimoPasso = etapa === etapasDaVez.length - 1;
  const progresso = useMemo(
    () => ((etapa + 1) / etapasDaVez.length) * 100,
    [etapa, etapasDaVez.length]
  );

  /** Sugestões do select searchable de especialidade (RN-10), máx. 6. */
  const sugestoesEspecialidades = useMemo(() => {
    const termo = normalizar(form.especialidadeProcurada);
    const filtradas = termo
      ? ESPECIALIDADES.filter((e) => normalizar(e).includes(termo))
      : ESPECIALIDADES;
    return filtradas.slice(0, 6);
  }, [form.especialidadeProcurada]);

  const setCampo = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const avancar = () => {
    setErro(null);
    // RN-10: quando respondeu "Não fui atendido", o motivo é obrigatório (via Continuar).
    if (passo.chave === "atendimento" && form.foiAtendido === "NAO" && !form.motivoNaoAtendido) {
      setErro("Informe o principal motivo (obrigatório quando não foi atendido).");
      return;
    }
    if (ultimoPasso) {
      enviar();
    } else {
      setEtapa((e) => e + 1);
    }
  };

  const pular = () => avancar();

  const enviar = async () => {
    if (!form.nota) {
      setErro("A avaliação com estrelas é obrigatória.");
      return;
    }
    setEnviando(true);
    setErro(null);
    const payload = {
      visitaId,
      fezTriagem: form.fezTriagem || undefined,
      especialidadeProcurada: form.especialidadeProcurada || undefined,
      foiAtendido: form.foiAtendido || undefined,
      // Frontend envia o label amigável quando o paciente escolhe "Casos mais graves" (F-05);
      // o backend o normaliza para CLASSIFICACAO_RISCO.
      motivoNaoAtendido:
        form.foiAtendido === "NAO"
          ? form.motivoNaoAtendido === "CLASSIFICACAO_RISCO"
            ? "CASOS_MAIS_GRAVES_PRIORIDADE"
            : form.motivoNaoAtendido || undefined
          : undefined,
      teveMedico: form.teveMedico || undefined,
      medicacaoReceita: form.medicacaoReceita || undefined,
      tratamentoEquipe: form.tratamentoEquipe || undefined,
      nota: form.nota,
      comentario: form.comentario || undefined,
    };

    try {
      if (feedbackId) {
        await FeedbackService.atualizar(feedbackId, payload);
      } else {
        await FeedbackService.enviar(payload);
      }
      await concluirFeedback(visitaId);
      setEnviado(true);
    } catch (e) {
      // Já avaliado (dedupe RN-12): não deixa enviar de novo.
      if (e.status === 409) {
        setJaAvaliado(true);
      } else if (e.status === 404) {
        setErro("Esta visita não está mais disponível para avaliação.");
      } else {
        setErro(e.message || "Não foi possível enviar o feedback.");
      }
    } finally {
      setEnviando(false);
    }
  };

  // Tela de agradecimento (E3-06).
  if (enviado) {
    return (
      <SafeAreaView style={styles.containerCentral}>
        <View style={styles.cardAgradecimento}>
          <Text style={styles.tituloAgradecimento}>Obrigado pela sua avaliação!</Text>
          <Text style={styles.textoAgradecimento}>
            Sua opinião ajuda a melhorar o atendimento de quem chega a um hospital.
          </Text>
          <CSButton
            label="Concluir"
            variant="primary"
            onPress={() => navigation.goBack()}
            style={styles.botao}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (jaAvaliado) {
    return (
      <SafeAreaView style={styles.containerCentral}>
        <View style={styles.cardAgradecimento}>
          <Text style={styles.tituloAgradecimento}>Você já avaliou esta visita</Text>
          <Text style={styles.textoAgradecimento}>
            Só é possível enviar um feedback por visita.
          </Text>
          <CSButton
            label="Voltar"
            variant="primary"
            onPress={() => navigation.goBack()}
            style={styles.botao}
          />
        </View>
      </SafeAreaView>
    );
  }

  const renderizarEtapa = () => {
    switch (passo.chave) {
      case "triagem":
        return (
          <OpcoesFezTriagem
            valor={form.fezTriagem}
            rotulo={(o) => rotulos.fezTriagem[o]}
            aoSelecionar={(v) => setCampo("fezTriagem", v)}
          />
        );
      case "atendimento":
        return (
          <>
            <Text style={styles.pergunta}>Qual especialidade você procurou?</Text>
            <CSTextField
              placeholder="Pesquise a especialidade (ex.: pronto-socorro)"
              value={form.especialidadeProcurada}
              onChangeText={(t) => setCampo("especialidadeProcurada", t)}
            />
            {sugestoesEspecialidades.length > 0 ? (
              <View style={styles.sugestoes}>
                {sugestoesEspecialidades.map((especialidade) => (
                  <CSChip
                    key={especialidade}
                    label={especialidade}
                    selected={form.especialidadeProcurada === especialidade}
                    onPress={() => setCampo("especialidadeProcurada", especialidade)}
                  />
                ))}
              </View>
            ) : null}
            <Text style={styles.pergunta}>Você foi atendido?</Text>
            <OpcoesFezTriagem
              valor={form.foiAtendido}
              rotulo={(o) => rotulos.foiAtendido[o]}
              opcoes={["SIM", "NAO"]}
              aoSelecionar={(v) => setCampo("foiAtendido", v)}
            />
            {form.foiAtendido === "NAO" ? (
              <>
                <Text style={styles.pergunta}>Qual foi o principal motivo?</Text>
                <OpcoesFezTriagem
                  valor={form.motivoNaoAtendido}
                  rotulo={(o) => rotulos.motivoNaoAtendido[o]}
                  opcoes={Object.keys(rotulos.motivoNaoAtendido)}
                  aoSelecionar={(v) => setCampo("motivoNaoAtendido", v)}
                />
              </>
            ) : null}
            <Text style={styles.pergunta}>Um médico chegou a te atender?</Text>
            <OpcoesFezTriagem
              valor={form.teveMedico}
              rotulo={(o) => rotulos.teveMedico[o]}
              opcoes={["SIM", "NAO", "NAO_PRECISEI"]}
              aoSelecionar={(v) => setCampo("teveMedico", v)}
            />
          </>
        );
      case "medicamento":
        return (
          <>
            <Text style={styles.pergunta}>Você recebeu receita/medicação?</Text>
            <OpcoesFezTriagem
              valor={form.medicacaoReceita}
              rotulo={(o) => rotulos.medicacaoReceita[o]}
              opcoes={["RECEBI", "NAO_RECEBEU", "NAO_PRECISEI"]}
              aoSelecionar={(v) => setCampo("medicacaoReceita", v)}
            />
            <Text style={styles.pergunta}>Como foi o tratamento da equipe?</Text>
            <Estrelas
              testIDPrefix="tratamento"
              valor={form.tratamentoEquipe}
              aoSelecionar={(v) => {
                setNaoInteragi(false);
                setCampo("tratamentoEquipe", v);
              }}
            />
            <View style={styles.opcoes}>
              <CSChip
                label="Não interagi"
                selected={naoInteragi}
                onPress={() => {
                  setNaoInteragi(true);
                  setCampo("tratamentoEquipe", null);
                }}
              />
            </View>
            {form.tratamentoEquipe ? (
              <Text style={styles.rotuloEstrela}>
                {ROTULOS_TRATAMENTO[form.tratamentoEquipe - 1]}
              </Text>
            ) : null}
          </>
        );
      case "avaliacao":
        return (
          <>
            <Text style={styles.pergunta}>Dê uma nota para sua visita (obrigatório)</Text>
            <Estrelas valor={form.nota} aoSelecionar={(v) => setCampo("nota", v)} />
            <Text style={styles.pergunta}>Quer deixar um comentário? (opcional)</Text>
            <CSTextField
              placeholder="Conte como foi sua experiência"
              value={form.comentario}
              multiline
              onChangeText={(t) => setCampo("comentario", t)}
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.hospital}>{hospitalNome || "Sua visita"}</Text>
        <Text style={styles.etapaIndice}>
          Etapa {etapa + 1} de {etapasDaVez.length}
        </Text>
        <View style={styles.barraProgresso}>
          <View style={[styles.barraPreenchida, { width: `${progresso}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.conteudo}>
        <Text style={styles.titulo}>{passo.titulo}</Text>
        <Text style={styles.descricao}>{passo.descricao}</Text>
        {erro ? <Text style={styles.erro}>{erro}</Text> : null}
        {renderizarEtapa()}
      </ScrollView>

      <View style={styles.rodape}>
        {!ultimoPasso ? (
          <CSButton label="Pular" variant="tertiary" onPress={pular} style={styles.botaoPular} />
        ) : null}
        <CSButton
          label={ultimoPasso ? (feedbackId ? "Salvar alterações" : "Enviar avaliação") : "Continuar"}
          variant="primary"
          onPress={avancar}
          loading={enviando}
          style={styles.botaoContinuar}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  containerCentral: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: "center",
    padding: spacing.s6,
  },
  cardAgradecimento: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xl,
    padding: spacing.s6,
    alignItems: "center",
    gap: spacing.s3,
  },
  tituloAgradecimento: {
    ...typography.headlineSm,
    color: colors.onSurface,
    textAlign: "center",
  },
  textoAgradecimento: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
  botao: {
    marginTop: spacing.s3,
    alignSelf: "stretch",
  },
  header: {
    paddingHorizontal: spacing.s4,
    paddingTop: spacing.s4,
    paddingBottom: spacing.s3,
  },
  hospital: {
    ...typography.titleMd,
    color: colors.onSurfaceVariant,
  },
  etapaIndice: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    marginTop: spacing.s1,
  },
  barraProgresso: {
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceVariant,
    marginTop: spacing.s2,
    overflow: "hidden",
  },
  barraPreenchida: {
    height: "100%",
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  conteudo: {
    padding: spacing.s4,
    paddingBottom: spacing.s12,
    gap: spacing.s2,
  },
  titulo: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  descricao: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.s2,
  },
  pergunta: {
    ...typography.titleMd,
    color: colors.onSurface,
    marginTop: spacing.s4,
    marginBottom: spacing.s2,
  },
  opcoes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.s2,
  },
  sugestoes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.s2,
    marginTop: spacing.s2,
  },
  estrelas: {
    flexDirection: "row",
    gap: spacing.s2,
    marginVertical: spacing.s2,
  },
  estrelaBotao: {
    padding: spacing.s1,
  },
  rotuloEstrela: {
    ...typography.bodySm,
    color: colors.tertiary,
  },
  erro: {
    ...typography.bodyMd,
    color: colors.error,
    marginTop: spacing.s2,
  },
  rodape: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s2,
    padding: spacing.s4,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  botaoPular: {
    flexShrink: 0,
  },
  botaoContinuar: {
    flex: 1,
  },
});
