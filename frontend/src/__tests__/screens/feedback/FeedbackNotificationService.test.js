/**
 * Notificações e pendências de feedback pós-saída (Épico 03) — E3-01/E3-03/RN-09.
 * - E3-01: pedido inicial 1 min após a saída.
 * - E3-03: janela de 24h + 1 lembrete único ~6h depois do pedido.
 * - RN-09: após 24h a pendência expira.
 * - 04/10/2026: cada visita tem a sua pendência, guardada até responder, dispensar ou
 *   vencer (o feedback se perdia quando o usuário não respondia na hora ou o celular
 *   descarregava).
 */
import * as Notifications from "expo-notifications";
import {
  agendarFeedback,
  agendarLembrete,
  concluirFeedback,
  dispensarFeedback,
  feedbackAvaliavel,
  limparPendencias,
  listarPendencias,
  pendenciaDaVisita,
  sincronizarPendenciasDoServidor,
} from "../../../screens/feedback/service/FeedbackNotificationService";
import FeedbackService from "../../../screens/feedback/service/FeedbackService";
import TokenStorage from "../../../services/TokenStorage";

jest.mock("../../../screens/feedback/service/FeedbackService", () => ({
  __esModule: true,
  default: { listarPendentes: jest.fn() },
}));
jest.mock("../../../services/TokenStorage", () => ({
  __esModule: true,
  default: { getAccessToken: jest.fn() },
}));

const AsyncStorage = require("@react-native-async-storage/async-storage").default;

const HORA = 60 * 60 * 1000;
const CHAVE = "@saude_monitor:feedbacksPendentes";
const CHAVE_LEGADA = "@saude_monitor:feedbackPendente";

describe("FeedbackNotificationService (Épico 03)", () => {
  let agora;
  let proximoId;

  beforeEach(() => {
    jest.useFakeTimers();
    agora = new Date("2026-10-04T12:00:00.000Z").getTime();
    jest.setSystemTime(agora);
    AsyncStorage.__reset();
    jest.clearAllMocks();
    proximoId = 0;
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: true });
    Notifications.scheduleNotificationAsync.mockImplementation(async () => `notif-${++proximoId}`);
    Notifications.cancelScheduledNotificationAsync.mockResolvedValue();
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    TokenStorage.getAccessToken.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function saidaHa(ms) {
    return new Date(agora - ms).toISOString();
  }

  test("agendarFeedback agenda o pedido 1 min após a saída e o lembrete 6h depois (E3-01/E3-03)", async () => {
    await agendarFeedback({
      visitaId: "v1",
      hospitalId: "h1",
      hospitalNome: "Hospital Central",
      saidaEm: new Date(agora).toISOString(),
    });

    const datas = Notifications.scheduleNotificationAsync.mock.calls.map(
      ([args]) => new Date(args.trigger.date).getTime() - agora
    );
    expect(datas).toEqual([60 * 1000, 60 * 1000 + 6 * HORA]);
    expect(Notifications.scheduleNotificationAsync.mock.calls[0][0].content.data).toEqual({
      visitaId: "v1",
      hospitalId: "h1",
      abrirFeedback: true,
    });
  });

  test("o lembrete agendado continua valendo depois de gravar a pendência", async () => {
    // Bug antigo: gravar a pendência cancelava o lembrete que tinha acabado de agendar,
    // então o lembrete único do E3-03 nunca chegava.
    await agendarFeedback({ visitaId: "v1", hospitalNome: "UPA" });

    const pendencia = await pendenciaDaVisita("v1");
    expect(pendencia.lembreteId).toBe("notif-2");
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith("notif-2");
  });

  test("sem permissão de notificação a pendência é guardada mesmo assim", async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: false });
    Notifications.requestPermissionsAsync.mockResolvedValue({ granted: false });

    await agendarFeedback({ visitaId: "v1", hospitalNome: "UPA" });

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(await listarPendencias()).toHaveLength(1);
  });

  test("uma visita nova não apaga a pendência da visita anterior", async () => {
    await agendarFeedback({ visitaId: "v1", hospitalNome: "UPA", saidaEm: saidaHa(2 * HORA) });
    await agendarFeedback({ visitaId: "v2", hospitalNome: "HRAN", saidaEm: saidaHa(HORA) });

    const pendencias = await listarPendencias();

    expect(pendencias.map((p) => p.visitaId)).toEqual(["v2", "v1"]);
  });

  test("reagendar a mesma visita substitui a pendência dela, sem duplicar", async () => {
    await agendarFeedback({ visitaId: "v1", hospitalNome: "UPA" });
    await agendarFeedback({ visitaId: "v1", hospitalNome: "UPA 24h" });

    const pendencias = await listarPendencias();

    expect(pendencias).toHaveLength(1);
    expect(pendencias[0].hospitalNome).toBe("UPA 24h");
  });

  test("não agenda nem grava pendência quando a visita durou menos de 2 min (RN-01/RN-07)", async () => {
    const resultado = await agendarFeedback({ visitaId: "v-curta", hospitalNome: "UPA", duracaoMinutos: 1 });

    expect(resultado).toBeNull();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(await listarPendencias()).toEqual([]);
  });

  test("agenda normalmente quando a visita atingiu o piso de 2 min (RN-01/RN-07)", async () => {
    await agendarFeedback({ visitaId: "v-ok", hospitalNome: "UPA", duracaoMinutos: 2 });

    expect(await feedbackAvaliavel("v-ok")).toBe(true);
  });

  test("a pendência vencida (>24h) some da lista e do disco (RN-09)", async () => {
    await AsyncStorage.setItem(
      CHAVE,
      JSON.stringify([
        { visitaId: "velha", saidaEm: saidaHa(25 * HORA) },
        { visitaId: "nova", saidaEm: saidaHa(HORA) },
      ])
    );

    expect(await feedbackAvaliavel("velha")).toBe(false);
    expect((await listarPendencias()).map((p) => p.visitaId)).toEqual(["nova"]);
    expect(JSON.parse(await AsyncStorage.getItem(CHAVE))).toHaveLength(1);
  });

  test("migra a pendência guardada na chave antiga (versão anterior do app)", async () => {
    await AsyncStorage.setItem(
      CHAVE_LEGADA,
      JSON.stringify({ visitaId: "v-antiga", hospitalNome: "UPA", saidaEm: saidaHa(HORA) })
    );

    const pendencias = await listarPendencias();

    expect(pendencias.map((p) => p.visitaId)).toEqual(["v-antiga"]);
    expect(await AsyncStorage.getItem(CHAVE_LEGADA)).toBeNull();
  });

  test("concluirFeedback remove só a visita respondida e cancela as notificações dela", async () => {
    await agendarFeedback({ visitaId: "v1", hospitalNome: "UPA" });
    await agendarFeedback({ visitaId: "v2", hospitalNome: "HRAN" });

    await concluirFeedback("v1");

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("notif-1");
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("notif-2");
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith("notif-3");
    expect((await listarPendencias()).map((p) => p.visitaId)).toEqual(["v2"]);
  });

  test("concluirFeedback de visita sem pendência não mexe nas outras", async () => {
    await agendarFeedback({ visitaId: "v1", hospitalNome: "UPA" });

    await concluirFeedback("v-desconhecida");

    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(await listarPendencias()).toHaveLength(1);
  });

  test("dispensarFeedback tira da lista, cancela as notificações e o servidor não traz de volta", async () => {
    TokenStorage.getAccessToken.mockResolvedValue("token");
    FeedbackService.listarPendentes.mockResolvedValue([
      { visitaId: "v1", hospitalNome: "UPA", saida: saidaHa(HORA) },
    ]);
    await agendarFeedback({ visitaId: "v1", hospitalNome: "UPA", saidaEm: saidaHa(HORA) });

    await dispensarFeedback("v1");
    await sincronizarPendenciasDoServidor();

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("notif-1");
    expect(await listarPendencias()).toEqual([]);
  });

  test("agendarLembrete não duplica o lembrete que agendarFeedback já criou", async () => {
    await agendarFeedback({ visitaId: "v1", hospitalNome: "UPA" });

    await agendarLembrete({ visitaId: "v1", hospitalNome: "UPA" });

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  test("agendarLembrete agenda uma vez para a pendência vinda do servidor, dentro das 24h", async () => {
    TokenStorage.getAccessToken.mockResolvedValue("token");
    FeedbackService.listarPendentes.mockResolvedValue([
      { visitaId: "v-srv", hospitalNome: "HRAN", saida: saidaHa(20 * HORA) },
    ]);
    await sincronizarPendenciasDoServidor();

    await agendarLembrete({ visitaId: "v-srv" });
    await agendarLembrete({ visitaId: "v-srv" });

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const data = new Date(Notifications.scheduleNotificationAsync.mock.calls[0][0].trigger.date).getTime();
    expect(data).toBeLessThan(agora + 4 * HORA);
  });

  test("sincroniza com o servidor: traz a visita que o app não conhecia e preenche o nome do hospital", async () => {
    // Celular descarregou dentro do hospital: o backend encerrou a visita
    // (GPS_INTERROMPIDO) sem o app passar pelo checkout, então não havia pendência local.
    TokenStorage.getAccessToken.mockResolvedValue("token");
    await agendarFeedback({ visitaId: "v-geo", hospitalNome: null, saidaEm: saidaHa(HORA) });
    FeedbackService.listarPendentes.mockResolvedValue([
      { visitaId: "v-geo", hospitalNome: "UPA Ceilândia", saida: saidaHa(HORA) },
      { visitaId: "v-apagou", hospitalNome: "HRAN", saida: saidaHa(3 * HORA) },
      { visitaId: "v-vencida", hospitalNome: "HUB", saida: saidaHa(30 * HORA) },
    ]);

    await sincronizarPendenciasDoServidor();
    const pendencias = await listarPendencias();

    expect(pendencias.map((p) => [p.visitaId, p.hospitalNome])).toEqual([
      ["v-geo", "UPA Ceilândia"],
      ["v-apagou", "HRAN"],
    ]);
  });

  test("anônimo não consulta o servidor", async () => {
    await sincronizarPendenciasDoServidor();

    expect(FeedbackService.listarPendentes).not.toHaveBeenCalled();
  });

  test("falha de rede na sincronização mantém a lista local", async () => {
    TokenStorage.getAccessToken.mockResolvedValue("token");
    FeedbackService.listarPendentes.mockRejectedValue(new Error("sem internet"));
    await agendarFeedback({ visitaId: "v1", hospitalNome: "UPA" });

    await sincronizarPendenciasDoServidor();

    expect(await listarPendencias()).toHaveLength(1);
  });

  test("limparPendencias (logout) apaga tudo e cancela as notificações", async () => {
    await agendarFeedback({ visitaId: "v1", hospitalNome: "UPA" });

    await limparPendencias();

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("notif-1");
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("notif-2");
    expect(await listarPendencias()).toEqual([]);
  });

  test("falha ao agendar a notificação não impede a pendência de aparecer na Home", async () => {
    Notifications.scheduleNotificationAsync.mockRejectedValue(new Error("limite do sistema"));
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});

    await agendarFeedback({ visitaId: "v1", hospitalNome: "UPA" });

    expect(await feedbackAvaliavel("v1")).toBe(true);
    aviso.mockRestore();
  });

  test("a notificação tocada de uma visita dispensada não reabre o formulário", async () => {
    await agendarFeedback({ visitaId: "v1", hospitalNome: "UPA" });

    await dispensarFeedback("v1");

    expect(await pendenciaDaVisita("v1")).toBeNull();
  });

  test("migração troca o nome genérico 'Hospital' pelo real na sincronização", async () => {
    TokenStorage.getAccessToken.mockResolvedValue("token");
    await AsyncStorage.setItem(
      CHAVE_LEGADA,
      JSON.stringify({ visitaId: "v-geo", hospitalNome: "Hospital", saidaEm: saidaHa(HORA) })
    );
    FeedbackService.listarPendentes.mockResolvedValue([
      { visitaId: "v-geo", hospitalNome: "UPA Ceilândia", saida: saidaHa(HORA) },
    ]);

    await sincronizarPendenciasDoServidor();

    expect((await pendenciaDaVisita("v-geo")).hospitalNome).toBe("UPA Ceilândia");
  });

  test("resposta do servidor que chega depois do logout não grava as visitas de quem saiu", async () => {
    TokenStorage.getAccessToken.mockResolvedValueOnce("token").mockResolvedValue(null);
    FeedbackService.listarPendentes.mockResolvedValue([
      { visitaId: "v-srv", hospitalNome: "HRAN", saida: saidaHa(HORA) },
    ]);

    await sincronizarPendenciasDoServidor();

    expect(await listarPendencias()).toEqual([]);
  });

  test("visita que só o servidor conhecia ganha o lembrete único, sem pedir permissão de novo", async () => {
    TokenStorage.getAccessToken.mockResolvedValue("token");
    FeedbackService.listarPendentes.mockResolvedValue([
      { visitaId: "v-srv", hospitalNome: "HRAN", saida: saidaHa(HORA) },
    ]);

    await sincronizarPendenciasDoServidor();

    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect((await pendenciaDaVisita("v-srv")).lembrado).toBe(true);
  });

  test("sem permissão de notificação a visita do servidor entra na lista sem lembrete", async () => {
    TokenStorage.getAccessToken.mockResolvedValue("token");
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: false });
    FeedbackService.listarPendentes.mockResolvedValue([
      { visitaId: "v-srv", hospitalNome: "HRAN", saida: saidaHa(HORA) },
    ]);

    await sincronizarPendenciasDoServidor();

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(await listarPendencias()).toHaveLength(1);
  });
});
