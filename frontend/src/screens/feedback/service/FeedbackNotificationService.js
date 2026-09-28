import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { solicitarPermissaoNotificacao } from "../../../services/NotificacaoPermissao";

/**
 * Notificações locais de feedback pós-saída (Épico 03 — F-05/E3-01/E3-03).
 *
 * - E3-01: notificação ~1–5 min após a saída (checkout) pedindo o feedback.
 * - E3-03: janela de resposta de 24h; 1 único lembrete se não responder.
 * - RN-13: feedback anônimo — a notificação não expõe dados pessoais (RN-17/RN-19).
 *
 * O estado de pendência fica em AsyncStorage para o app re-agendar quando voltar ao
 * foreground (períodos em que o app esteve fechado ainda podem disparar dentro da
 * janela). Ao responder, `concluirFeedback` remove a pendência e cancelea o lembrete.
 */

const FECHADO_KEY = "@saude_monitor:feedbackPendente";

// Janela de resposta total (24h) e prazo (em ms) para o pedido inicial após a saída.
const JANELA_MS = 24 * 60 * 60 * 1000;

/**
 * Atraso do pedido de feedback após a saída: 1 minuto (decisão do PO em 28/09/2026,
 * reduzido do intervalo 1–5 min anterior de E3-01, para o convite chegar logo após o
 * checkout). Fixo, então reagendar a mesma visita cai no mesmo horário (idempotência).
 */
const ATRASO_PEDIDO_MS = 1 * 60 * 1000;

/**
 * RN-01/RN-07: visita com menos de 2 minutos não gera convite de feedback — é o mesmo
 * piso que a agregação do backend usa para descartar visitas curtas das estatísticas.
 * Sem esta guarda, um check-in seguido de checkout imediato (típico do check-in manual)
 * disparava a pesquisa mesmo assim.
 */
export const DURACAO_MINIMA_FEEDBACK_MIN = 2;

// Handler para exibir notificação no foreground sem nativo.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Monta o objeto de pendência persistido no AsyncStorage. O `payload` segue anônimo
 * (sem dados pessoais), apenas o necessário para abrir o formulário.
 */
function montarPendencia({ visitaId, hospitalId, hospitalNome, saidaEm }) {
  return {
    visitaId,
    hospitalId,
    hospitalNome: hospitalNome || "Hospital",
    saidaEm: saidaEm || new Date().toISOString(),
    lembrado: false,
  };
}

async function armazenarPendencia(pendencia) {
  await AsyncStorage.setItem(FECHADO_KEY, JSON.stringify(pendencia));
  try {
    await Notifications.cancelScheduledNotificationAsync(pendencia.lembreteId);
  } catch {
    /* nenhum lembrete agendado ainda */
  }
  return pendencia;
}

/**
 * Pede permissão de notificação. Não é obrigatória (feedback segue pelo app), mas sem
 * ela o pedido pós-saída não aparece — por isso retorna se foi concedida.
 *
 * Delega ao helper compartilhado, também usado pelo opt-in do Perfil (E6-05).
 */
export async function pedirPermissaoNotificacao() {
  return solicitarPermissaoNotificacao();
}

/**
 * Agenda o pedido de feedback após a saída (E3-01) e o lembretete (E3-03, 1x).
 * Idempotente: novas chamadas para a mesma visita substituem a pendência.
 */
export async function agendarFeedback({ visitaId, hospitalId, hospitalNome, saidaEm, duracaoMinutos }) {
  // RN-01/RN-07: visita curta (< 2 min) não convida para feedback. Quando a duração é
  // conhecida (resposta do checkout, ou cálculo local no caminho offline) e fica abaixo do
  // piso, não agenda nada e nem grava pendência — devolve null para o chamador saber.
  if (Number.isFinite(duracaoMinutos) && duracaoMinutos < DURACAO_MINIMA_FEEDBACK_MIN) {
    return null;
  }

  const granted = await pedirPermissaoNotificacao();
  const pendencia = montarPendencia({ visitaId, hospitalId, hospitalNome, saidaEm });

  const disparaAgora = Number(saidaEm ? new Date(saidaEm).getTime() : Date.now());
  const base = Number.isFinite(disparaAgora) ? disparaAgora : Date.now();

  // Pedido inicial 1 minuto após a saída (E3-01, ajustado pelo PO em 28/09/2026).
  const pedidoEm = base + ATRASO_PEDIDO_MS;

  // Limpa agendamentos anteriores desta visita antes de reagendar.
  const agendamentos = await Notifications.getAllScheduledNotificationsAsync();
  const antigos = agendamentos.filter((n) => n.content?.data?.visitaId === visitaId);
  await Promise.all(antigos.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));

  let pedidoId;
  if (granted) {
    pedidoId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Como foi sua visita?",
        body: `${pendencia.hospitalNome}: conte como foi o atendimento. Leva menos de 1 minuto.`,
        data: { visitaId, hospitalId, abrirFeedback: true },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(pedidoEm) },
    });
  }

  pendencia.pedidoId = pedidoId;
  await armazenarPendencia(pendencia);
  return pendencia;
}

/**
 * Prepara o lembrete único (E3-03) — chamado quando o pedido inicial foi disparado e
 * o feedback ainda não foi respondido. Não dispara se o feedback já foi concluído.
 */
export async function agendarLembrete({ visitaId, hospitalNome }) {
  const pendencia = await pendenciaAtual();
  if (!pendencia || pendencia.visitaId !== visitaId || pendencia.lembrado) {
    return;
  }
  pendencia.lembrado = true;
  pendencia.lembreteId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Ainda dá tempo de avaliar sua visita",
      body: `${hospitalNome || pendencia.hospitalNome}: sua opinião ajuda quem precisa de atendimento.`,
      data: { visitaId, abrirFeedback: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      // Plano-Sprints E3-03: lembrete único ~6h após o pedido inicial (janela de 24h, RN-09).
      date: new Date(Date.now() + 6 * 60 * 60 * 1000),
    },
  });
  await armazenarPendencia(pendencia);
}

/** Pendência ativa (ou null). */
export async function pendenciaAtual() {
  const raw = await AsyncStorage.getItem(FECHADO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Verdadeiro se ainda há uma pendência dentro da janela de 24h.
 * Expira a pendência vencida (RN-09: após 24h a visita deixa de ser avaliável).
 */
export async function feedbackAvaliavel() {
  const pendencia = await pendenciaAtual();
  if (!pendencia) return false;
  const saida = Number(new Date(pendencia.saidaEm).getTime());
  if (!Number.isFinite(saida)) return false;
  if (Date.now() - saida > JANELA_MS) {
    await AsyncStorage.removeItem(FECHADO_KEY);
    return false;
  }
  return true;
}

/**
 * Conclui o fluxo: remove a pendência e cancela pedido/lembrete pendentes.
 *
 * O `visitaId` era recebido e ignorado (achado do lint, E8-13): responder o
 * feedback de uma visita apagava a pendência guardada, fosse ela de qual visita
 * fosse. Na prática só existe uma pendência por vez, mas quando as duas se
 * conhecem e discordam, o certo é não mexer — cancelar a notificação de outra
 * visita faria o usuário nunca ser lembrado dela.
 */
export async function concluirFeedback(visitaId) {
  const pendencia = await pendenciaAtual();
  if (pendencia && visitaId && pendencia.visitaId && pendencia.visitaId !== visitaId) {
    return;
  }
  if (pendencia) {
    await Promise.all(
      [pendencia.pedidoId, pendencia.lembreteId]
        .filter(Boolean)
        .map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
    );
    await AsyncStorage.removeItem(FECHADO_KEY);
  }
}
