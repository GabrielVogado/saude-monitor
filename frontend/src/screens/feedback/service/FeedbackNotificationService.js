import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { solicitarPermissaoNotificacao } from "../../../services/NotificacaoPermissao";
import TokenStorage from "../../../services/TokenStorage";
import FeedbackService from "./FeedbackService";

/**
 * Notificações locais e pendências de feedback pós-saída (Épico 03 — F-05/E3-01/E3-03).
 *
 * - E3-01: notificação 1 min após a saída (checkout) pedindo o feedback.
 * - E3-03: janela de resposta de 24h; 1 único lembrete ~6h após o pedido.
 * - RN-13: feedback anônimo — a notificação não expõe dados pessoais (RN-17/RN-19).
 *
 * Cada visita encerrada vira uma pendência guardada no AsyncStorage (disco), que
 * sobrevive ao app fechado e ao celular desligado. Enquanto a janela de 24h estiver
 * aberta, a Home lista as pendências e o usuário avalia quando puder — a notificação
 * deixou de ser o único caminho até o formulário (pedido do PO em 04/10/2026: o
 * feedback se perdia quando o usuário não respondia na hora ou o celular descarregava).
 * Uma visita nova não apaga mais a pendência da anterior.
 *
 * Para quem está logado, `sincronizarPendenciasDoServidor` completa a lista com as
 * visitas que o backend sabe que aguardam avaliação — inclusive a encerrada por
 * GPS_INTERROMPIDO quando o celular apagou dentro do hospital, que nunca passou pelo
 * checkout do app e por isso não tinha pendência local.
 */

const PENDENCIAS_KEY = "@saude_monitor:feedbacksPendentes";

/** Chave antiga (até 04/10/2026): uma única pendência, substituída a cada visita. */
const PENDENCIA_LEGADA_KEY = "@saude_monitor:feedbackPendente";

// Janela de resposta total (24h, RN-09).
export const JANELA_MS = 24 * 60 * 60 * 1000;

/**
 * Atraso do pedido de feedback após a saída: 1 minuto (decisão do PO em 28/09/2026,
 * reduzido do intervalo 1–5 min anterior de E3-01, para o convite chegar logo após o
 * checkout). Fixo, então reagendar a mesma visita cai no mesmo horário (idempotência).
 */
const ATRASO_PEDIDO_MS = 1 * 60 * 1000;

/** E3-03: lembrete único ~6h após o pedido inicial, ainda dentro da janela de 24h. */
const ATRASO_LEMBRETE_MS = 6 * 60 * 60 * 1000;

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
 * Serializa as leituras-e-escritas da lista: a tarefa de geofence (saída automática) e
 * a tela (envio do formulário, sincronização) podem mexer nela ao mesmo tempo, e o
 * AsyncStorage não tem transação — sem a fila, a última escrita apagava a outra.
 */
let fila = Promise.resolve();
function emSerie(operacao) {
  const resultado = fila.then(operacao, operacao);
  fila = resultado.catch(() => {});
  return resultado;
}

function instanteSaida(pendencia) {
  return Number(new Date(pendencia?.saidaEm).getTime());
}

/** Pendência ainda dentro da janela de 24h após a saída (RN-09). */
function dentroDaJanela(pendencia, agora = Date.now()) {
  const saida = instanteSaida(pendencia);
  return Number.isFinite(saida) && agora - saida <= JANELA_MS;
}

function cancelarNotificacoes(pendencia) {
  return Promise.all(
    [pendencia?.pedidoId, pendencia?.lembreteId]
      .filter(Boolean)
      .map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
  );
}

async function lerBruto() {
  let lista = [];
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(PENDENCIAS_KEY)) || "[]");
    lista = Array.isArray(parsed) ? parsed : [];
  } catch {
    lista = [];
  }

  // Migração da chave antiga: a pendência guardada por uma versão anterior do app
  // continua valendo, só muda de lugar.
  const legada = await AsyncStorage.getItem(PENDENCIA_LEGADA_KEY);
  if (legada) {
    try {
      const pendencia = JSON.parse(legada);
      if (pendencia?.visitaId && !lista.some((p) => p.visitaId === pendencia.visitaId)) {
        // A versão antiga gravava "Hospital" quando não sabia o nome (saída por
        // geofence); vira null para a sincronização poder trocar pelo nome real.
        if (pendencia.hospitalNome === "Hospital") pendencia.hospitalNome = null;
        lista.push(pendencia);
      }
    } catch {
      /* conteúdo corrompido: descarta */
    }
    await AsyncStorage.setItem(PENDENCIAS_KEY, JSON.stringify(lista));
    await AsyncStorage.removeItem(PENDENCIA_LEGADA_KEY);
  }
  return lista;
}

/** Lê a lista já sem as pendências vencidas (RN-09), persistindo a limpeza. */
async function lerVigentes() {
  const lista = await lerBruto();
  const vigentes = lista.filter((p) => dentroDaJanela(p));
  if (vigentes.length !== lista.length) {
    await AsyncStorage.setItem(PENDENCIAS_KEY, JSON.stringify(vigentes));
  }
  return vigentes;
}

async function gravar(lista) {
  await AsyncStorage.setItem(PENDENCIAS_KEY, JSON.stringify(lista));
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
 * Guarda a pendência da visita e agenda o pedido (E3-01) e o lembrete único (E3-03).
 * Idempotente: novas chamadas para a mesma visita substituem a pendência dela, sem
 * tocar nas pendências de outras visitas.
 */
export async function agendarFeedback({ visitaId, hospitalId, hospitalNome, saidaEm, duracaoMinutos }) {
  // RN-01/RN-07: visita curta (< 2 min) não convida para feedback. Quando a duração é
  // conhecida (resposta do checkout, ou cálculo local no caminho offline) e fica abaixo do
  // piso, não agenda nada e nem grava pendência — devolve null para o chamador saber.
  if (Number.isFinite(duracaoMinutos) && duracaoMinutos < DURACAO_MINIMA_FEEDBACK_MIN) {
    return null;
  }

  const saida = Number(saidaEm ? new Date(saidaEm).getTime() : Date.now());
  const base = Number.isFinite(saida) ? saida : Date.now();
  const pendencia = {
    visitaId,
    hospitalId,
    hospitalNome: hospitalNome || null,
    saidaEm: new Date(base).toISOString(),
    lembrado: false,
  };

  // A pendência vai para o disco ANTES de qualquer chamada de notificação: se a
  // permissão ou o agendamento falharem, a visita ainda aparece na Home.
  await emSerie(async () => {
    const lista = (await lerVigentes()).filter((p) => p.visitaId !== visitaId);
    lista.push(pendencia);
    await gravar(lista);
  });

  try {
    const ids = await agendarNotificacoes(pendencia, base + ATRASO_PEDIDO_MS);
    Object.assign(pendencia, ids);
    if (ids.pedidoId || ids.lembreteId) {
      await atualizarPendencia(visitaId, ids);
    }
  } catch (erro) {
    // eslint-disable-next-line no-console
    console.warn("FeedbackNotificationService: falha ao agendar notificações", erro?.message);
  }
  return pendencia;
}

/** Agenda pedido + lembrete único da pendência; devolve os ids (vazio sem permissão). */
async function agendarNotificacoes({ visitaId, hospitalId, hospitalNome }, pedidoEm) {
  const granted = await pedirPermissaoNotificacao();
  const nomeExibido = hospitalNome || "Hospital";

  // Limpa agendamentos anteriores desta visita antes de reagendar.
  const agendamentos = await Notifications.getAllScheduledNotificationsAsync();
  const antigos = agendamentos.filter((n) => n.content?.data?.visitaId === visitaId);
  await Promise.all(antigos.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));

  if (!granted) {
    return {};
  }
  const pedidoId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Como foi sua visita?",
      body: `${nomeExibido}: conte como foi o atendimento. Leva menos de 1 minuto.`,
      data: { visitaId, hospitalId, abrirFeedback: true },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(pedidoEm) },
  });
  // O lembrete já sai agendado aqui: antes ele só era criado quando o usuário tocava
  // no pedido — justamente quem não viu a primeira notificação ficava sem lembrete.
  const lembreteId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Ainda dá tempo de avaliar sua visita",
      body: `${nomeExibido}: sua opinião ajuda quem precisa de atendimento.`,
      data: { visitaId, hospitalId, abrirFeedback: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(pedidoEm + ATRASO_LEMBRETE_MS),
    },
  });
  return { pedidoId, lembreteId, lembrado: true };
}

/** Grava campos numa pendência que ainda exista (pode ter sido respondida no meio). */
async function atualizarPendencia(visitaId, campos) {
  await emSerie(async () => {
    const lista = await lerVigentes();
    const pendencia = lista.find((p) => p.visitaId === visitaId);
    if (!pendencia) {
      await Promise.all(
        [campos.pedidoId, campos.lembreteId]
          .filter(Boolean)
          .map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
      );
      return;
    }
    Object.assign(pendencia, campos);
    await gravar(lista);
  });
}

/**
 * Lembrete único (E3-03) para uma pendência que ainda não tem um. Não duplica: a
 * pendência criada por `agendarFeedback` já sai com o lembrete agendado, e uma segunda
 * chamada não faz nada. A que veio do servidor recebe o seu na sincronização.
 */
export async function agendarLembrete({ visitaId, hospitalNome }) {
  return emSerie(async () => {
    const lista = await lerVigentes();
    const pendencia = lista.find((p) => p.visitaId === visitaId);
    if (!pendencia || pendencia.lembrado || pendencia.dispensada) {
      return;
    }
    pendencia.lembrado = true;
    pendencia.lembreteId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Ainda dá tempo de avaliar sua visita",
        body: `${hospitalNome || pendencia.hospitalNome || "Hospital"}: sua opinião ajuda quem precisa de atendimento.`,
        data: { visitaId, abrirFeedback: true },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        // Nunca depois do fim da janela de 24h (RN-09).
        date: new Date(
          Math.min(Date.now() + ATRASO_LEMBRETE_MS, instanteSaida(pendencia) + JANELA_MS - 60 * 1000)
        ),
      },
    });
    await gravar(lista);
  });
}

/**
 * Pendências que o usuário ainda pode responder, da saída mais recente para a mais
 * antiga. As vencidas (24h, RN-09) são removidas; as dispensadas ficam guardadas até
 * vencer (para a sincronização com o servidor não trazê-las de volta), mas não aparecem.
 */
export async function listarPendencias() {
  const lista = await emSerie(lerVigentes);
  return lista
    .filter((p) => !p.dispensada)
    .sort((a, b) => instanteSaida(b) - instanteSaida(a));
}

/**
 * Pendência da visita, se ainda estiver dentro da janela de 24h e não tiver sido
 * dispensada (ou null) — uma notificação já entregue continua na bandeja depois do
 * "Agora não", e tocá-la não pode reabrir o formulário (RN-09).
 */
export async function pendenciaDaVisita(visitaId) {
  if (!visitaId) return null;
  const lista = await emSerie(lerVigentes);
  return lista.find((p) => p.visitaId === visitaId && !p.dispensada) || null;
}

/**
 * Verdadeiro se a visita ainda tem pendência dentro da janela de 24h (RN-09).
 * A pendência vencida é removida no caminho.
 */
export async function feedbackAvaliavel(visitaId) {
  return (await pendenciaDaVisita(visitaId)) !== null;
}

async function removerPendencia(visitaId, { manterDispensada }) {
  if (!visitaId) return;
  await emSerie(async () => {
    const lista = await lerVigentes();
    const pendencia = lista.find((p) => p.visitaId === visitaId);
    if (!pendencia) return;
    await cancelarNotificacoes(pendencia);
    const restantes = lista.filter((p) => p.visitaId !== visitaId);
    if (manterDispensada) {
      restantes.push({ ...pendencia, dispensada: true, pedidoId: null, lembreteId: null });
    }
    await gravar(restantes);
  });
}

/**
 * Conclui o fluxo da visita: remove a pendência dela e cancela pedido/lembrete.
 * Só mexe na visita informada — as pendências de outras visitas continuam.
 */
export async function concluirFeedback(visitaId) {
  await removerPendencia(visitaId, { manterDispensada: false });
}

/**
 * "Agora não": tira a pendência da lista e cancela as notificações dela. RN-09 pede que
 * a visita não incomode mais quem não quer responder.
 */
export async function dispensarFeedback(visitaId) {
  await removerPendencia(visitaId, { manterDispensada: true });
}

/**
 * Completa a lista local com as visitas que o backend diz aguardarem feedback
 * (`GET /api/v1/contas/feedbacks/pendentes`). Só para quem está logado — o anônimo
 * conta apenas com a pendência local. Falha de rede é silenciosa: a lista local
 * continua valendo e a próxima abertura do app tenta de novo.
 *
 * Também preenche o nome do hospital nas pendências locais que não o tinham (a saída
 * automática por geofence não conhece o nome).
 */
export async function sincronizarPendenciasDoServidor() {
  if (!(await TokenStorage.getAccessToken())) {
    return;
  }
  let remotas;
  try {
    remotas = await FeedbackService.listarPendentes();
  } catch {
    return;
  }
  if (!Array.isArray(remotas) || remotas.length === 0) {
    return;
  }

  const novas = await emSerie(async () => {
    // A resposta pode chegar depois de um logout feito no meio do caminho: sem esta
    // segunda checagem, as visitas de quem saiu voltariam para o aparelho (LGPD).
    if (!(await TokenStorage.getAccessToken())) {
      return [];
    }
    const lista = await lerVigentes();
    const adicionadas = [];
    let mudou = false;
    for (const remota of remotas) {
      if (!remota?.visitaId || !remota?.saida) continue;
      const local = lista.find((p) => p.visitaId === remota.visitaId);
      if (local) {
        if (!local.hospitalNome && remota.hospitalNome) {
          local.hospitalNome = remota.hospitalNome;
          mudou = true;
        }
        continue;
      }
      const nova = {
        visitaId: remota.visitaId,
        hospitalId: remota.hospitalId,
        hospitalNome: remota.hospitalNome || null,
        saidaEm: remota.saida,
        lembrado: false,
      };
      if (dentroDaJanela(nova)) {
        lista.push(nova);
        adicionadas.push(nova);
        mudou = true;
      }
    }
    if (mudou) {
      await gravar(lista);
    }
    return adicionadas;
  });

  // A visita que só o servidor conhecia (ex.: celular apagou dentro do hospital) não
  // teve pedido nem lembrete: ganha o lembrete único, se o usuário já permitiu
  // notificações — sem abrir o diálogo de permissão a cada abertura do app.
  if (novas.length > 0 && (await notificacoesPermitidas())) {
    for (const nova of novas) {
      await agendarLembrete({ visitaId: nova.visitaId }).catch(() => {});
    }
  }
}

async function notificacoesPermitidas() {
  try {
    return Boolean((await Notifications.getPermissionsAsync())?.granted);
  } catch {
    return false;
  }
}

/**
 * Apaga todas as pendências e cancela as notificações delas (logout e exclusão de
 * conta). A pendência carrega o hospital visitado — dado de saúde (LGPD, art. 11) —
 * e não pode aparecer para a próxima pessoa que usar o mesmo aparelho.
 */
export async function limparPendencias() {
  await emSerie(async () => {
    const lista = await lerBruto();
    await Promise.all(lista.map(cancelarNotificacoes));
    await AsyncStorage.removeItem(PENDENCIAS_KEY);
  });
}
