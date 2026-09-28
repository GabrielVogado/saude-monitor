/**
 * Notificações de feedback pós-saída (Épico 03) — E3-01/E3-03/RN-09.
 * - E3-01: pedido inicial ~1–5 min após a saída.
 * - E3-03: janela de 24h + 1 lembrete único.
 * - RN-09: após 24h a pendência expira.
 */
import * as Notifications from "expo-notifications";
import {
  agendarFeedback,
  agendarLembrete,
  pendenciaAtual,
  feedbackAvaliavel,
  concluirFeedback,
} from "../../../screens/feedback/service/FeedbackNotificationService";

const AsyncStorage = require("@react-native-async-storage/async-storage").default;

describe("FeedbackNotificationService (Épico 03)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    AsyncStorage.__reset();
    jest.clearAllMocks();
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: true });
    Notifications.cancelScheduledNotificationAsync.mockResolvedValue();
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("feedbackAvaliavel retorna true dentro da janela de 24h (RN-09)", async () => {
    const agora = Date.now();
    jest.setSystemTime(agora);
    await AsyncStorage.setItem(
      "@saude_monitor:feedbackPendente",
      JSON.stringify({ visitaId: "v1", saidaEm: new Date(agora - 1000 * 60).toISOString() })
    );
    expect(await feedbackAvaliavel()).toBe(true);
  });

  test("feedbackAvaliavel expira a pendência após 24h e remove do storage (RN-09)", async () => {
    const agora = Date.now();
    jest.setSystemTime(agora);
    await AsyncStorage.setItem(
      "@saude_monitor:feedbackPendente",
      JSON.stringify({ visitaId: "v1", saidaEm: new Date(agora - 25 * 60 * 60 * 1000).toISOString() })
    );
    expect(await feedbackAvaliavel()).toBe(false);
    expect(await pendenciaAtual()).toBeNull();
  });

  test("concluirFeedback de outra visita não apaga a pendência guardada", async () => {
    await agendarFeedback({ visitaId: "v1", hospitalNome: "UPA" });
    const pendencia = await pendenciaAtual();

    await concluirFeedback("v2");

    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
      pendencia.pedidoId
    );
    expect(await pendenciaAtual()).not.toBeNull();
  });

  test("agendarFeedback agenda o pedido 1 min após a saída (E3-01, ajuste do PO)", async () => {
    const agora = Date.now();
    jest.setSystemTime(agora);
    await agendarFeedback({
      visitaId: "v-12345",
      hospitalId: "h1",
      hospitalNome: "Hospital Central",
      saidaEm: new Date(agora).toISOString(),
    });

    const pendencia = await pendenciaAtual();
    expect(pendencia.visitaId).toBe("v-12345");
    expect(pendencia.hospitalNome).toBe("Hospital Central");
    expect(pendencia.lembrado).toBe(false);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const [args] = Notifications.scheduleNotificationAsync.mock.calls[0];
    const deltaMs = new Date(args.trigger.date).getTime() - agora;
    // exatamente 1 minuto após a saída
    expect(deltaMs).toBe(1 * 60 * 1000);
    expect(args.content.data.abrirFeedback).toBe(true);
  });

  test("o atraso é fixo em 1 min, independente do visitaId", async () => {
    // Antes, um bug prendia o atraso no teto de 5 min; e o espalhamento por id foi removido
    // quando o PO fixou o pedido em 1 min. Ids diferentes agora dão o mesmo atraso.
    const agora = Date.now();
    jest.setSystemTime(agora);

    await agendarFeedback({ visitaId: "a".repeat(24), hospitalNome: "UPA", saidaEm: new Date(agora).toISOString() });
    const deltaA = new Date(Notifications.scheduleNotificationAsync.mock.calls[0][0].trigger.date).getTime() - agora;

    Notifications.scheduleNotificationAsync.mockClear();
    AsyncStorage.__reset();

    await agendarFeedback({ visitaId: "b".repeat(24), hospitalNome: "UPA", saidaEm: new Date(agora).toISOString() });
    const deltaB = new Date(Notifications.scheduleNotificationAsync.mock.calls[0][0].trigger.date).getTime() - agora;

    expect(deltaA).toBe(1 * 60 * 1000);
    expect(deltaB).toBe(1 * 60 * 1000);
  });

  test("não agenda nem grava pendência quando a visita durou menos de 2 min (RN-01/RN-07)", async () => {
    // Bug relatado: check-in seguido de checkout imediato convidava para feedback.
    const resultado = await agendarFeedback({
      visitaId: "v-curta",
      hospitalId: "h1",
      hospitalNome: "UPA",
      duracaoMinutos: 1,
    });

    expect(resultado).toBeNull();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(await pendenciaAtual()).toBeNull();
  });

  test("agenda normalmente quando a visita atingiu o piso de 2 min (RN-01/RN-07)", async () => {
    await agendarFeedback({
      visitaId: "v-ok",
      hospitalId: "h1",
      hospitalNome: "UPA",
      duracaoMinutos: 2,
    });

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(await pendenciaAtual()).not.toBeNull();
  });

  test("agendarLembrete dispara apenas 1 lembrete (E3-03)", async () => {
    const agora = Date.now();
    jest.setSystemTime(agora);
    await agendarFeedback({ visitaId: "v1", hospitalNome: "UPA" });
    await agendarLembrete({ visitaId: "v1", hospitalNome: "UPA" });
    await agendarLembrete({ visitaId: "v1", hospitalNome: "UPA" });

    const pendencia = await pendenciaAtual();
    expect(pendencia.lembrado).toBe(true);
    // pedido inicial (1) + 1 lembrete (2); chamadas repetidas não duplicam
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  test("concluirFeedback cancela pedido/lembrete e remove a pendência", async () => {
    await agendarFeedback({ visitaId: "v1", hospitalNome: "UPA" });
    const pendencia = await pendenciaAtual();
    await concluirFeedback("v1");
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(pendencia.pedidoId);
    expect(await pendenciaAtual()).toBeNull();
  });
});
