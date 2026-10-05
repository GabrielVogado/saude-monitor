/* eslint-disable no-console -- os testes de falha conferem os avisos do serviço. */
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import HospitalService from "../../../screens/hospitais/service/HospitalService";
import VisitaService from "../../../screens/visitas/service/VisitaService";

/**
 * Testes do geofencing nativo (BUG-08).
 *
 * O arquivo não tinha teste algum até aqui, e era ele quem decidia quem vira paciente:
 * monitorava todos os hospitais com um raio fixo de 120 m e mandava ao servidor, como
 * "posição do usuário", a coordenada do próprio hospital — o que fazia a validação
 * `$geoIntersects` do check-in aprovar qualquer disparo, inclusive o de quem estava a
 * duas ruas dali.
 */

jest.mock("expo-task-manager", () => ({
  __esModule: true,
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(async () => true),
}));

jest.mock("../../../screens/hospitais/service/HospitalService", () => ({
  __esModule: true,
  default: { listar: jest.fn() },
}));

jest.mock("../../../screens/visitas/service/VisitaService", () => ({
  __esModule: true,
  default: { checkin: jest.fn(), checkout: jest.fn(), buscarAtiva: jest.fn(), heartbeat: jest.fn() },
}));

jest.mock("../../../screens/feedback/service/FeedbackNotificationService", () => ({
  __esModule: true,
  // Assíncrona como a real: o serviço encadeia `.catch` no retorno.
  agendarFeedback: jest.fn(() => Promise.resolve(null)),
}));

// Fora do `jest.isolateModules`: cada carga do serviço recebe um módulo novo, e o
// prefixo `mock` deixa a fábrica apontar para a mesma função espiã.
const mockInvalidarVisitaAtiva = jest.fn(() => Promise.resolve());
jest.mock("../../../core/query/queryClient", () => ({
  __esModule: true,
  invalidarVisitaAtiva: (...args) => mockInvalidarVisitaAtiva(...args),
}));

const HOSPITAL_LAT = -15.9023;
const HOSPITAL_LON = -48.0742;

/**
 * Carrega o módulo do zero — como o SO faz ao acordar o app fechado — e devolve a API
 * pública + as duas tasks registradas (eventos de região e acompanhamento).
 */
function carregarServico() {
  let servico;
  jest.isolateModules(() => {
    servico = require("../../../screens/visitas/service/GeofencingTaskService");
  });
  const task = (nome) =>
    TaskManager.defineTask.mock.calls.filter(([n]) => n === nome).at(-1)[1];
  return {
    ...servico,
    executarTask: task(servico.GEOFENCING_TASK),
    executarAcompanhamento: task(servico.ACOMPANHAMENTO_TASK),
  };
}

// Atualizações de localização com estado, como no SO: ligar/desligar é observável.
let acompanhamentoLigado = false;

function permitirTudo() {
  AsyncStorage.__reset();
  acompanhamentoLigado = false;
  Location.hasStartedLocationUpdatesAsync.mockImplementation(async () => acompanhamentoLigado);
  Location.startLocationUpdatesAsync.mockImplementation(async () => {
    acompanhamentoLigado = true;
  });
  Location.stopLocationUpdatesAsync.mockImplementation(async () => {
    acompanhamentoLigado = false;
  });
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
  Location.getForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
  Location.getBackgroundPermissionsAsync.mockResolvedValue({ status: "granted" });
  Location.requestBackgroundPermissionsAsync.mockResolvedValue({ status: "granted" });
  Location.getCurrentPositionAsync.mockResolvedValue({
    coords: { latitude: HOSPITAL_LAT, longitude: HOSPITAL_LON },
  });
  Location.startGeofencingAsync.mockResolvedValue(undefined);
}

function hospital(id, raioMetros) {
  return {
    id,
    nome: `Unidade ${id}`,
    raioMetros,
    localizacao: { latitude: HOSPITAL_LAT, longitude: HOSPITAL_LON },
  };
}

describe("regiões monitoradas", () => {
  beforeEach(permitirTudo);

  it("usa o raio de cada hospital, com piso de 100 m para o disparo nativo", async () => {
    HospitalService.listar.mockResolvedValue({
      content: [hospital("ubs", 75), hospital("upa", 100), hospital("hospital", 150)],
    });
    const { iniciarGeofencing } = carregarServico();

    await iniciarGeofencing();

    const [, regioes] = Location.startGeofencingAsync.mock.calls[0];
    expect(regioes.slice(0, -1).map((r) => r.radius)).toEqual([100, 100, 150]);
  });

  it("cai no piso quando o hospital não informa raio", async () => {
    HospitalService.listar.mockResolvedValue({
      content: [hospital("sem-raio", undefined), hospital("raio-invalido", 0)],
    });
    const { iniciarGeofencing } = carregarServico();

    await iniciarGeofencing();

    const [, regioes] = Location.startGeofencingAsync.mock.calls[0];
    expect(regioes.slice(0, -1).map((r) => r.radius)).toEqual([100, 100]);
  });

  it("não monitora nada sem permissão de background", async () => {
    Location.getBackgroundPermissionsAsync.mockResolvedValue({ status: "denied", canAskAgain: true });
    Location.requestBackgroundPermissionsAsync.mockResolvedValue({ status: "denied" });
    jest.spyOn(Alert, "alert").mockImplementation((_t, _m, botoes) => botoes[1].onPress());
    const { iniciarGeofencing } = carregarServico();

    await iniciarGeofencing();

    expect(Location.startGeofencingAsync).not.toHaveBeenCalled();
  });

  it("explica o uso da localização antes de pedir a permissão \"o tempo todo\"", async () => {
    Location.getBackgroundPermissionsAsync.mockResolvedValue({ status: "denied", canAskAgain: true });
    HospitalService.listar.mockResolvedValue({ content: [hospital("h1", 150)] });
    const alerta = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, botoes) => botoes[1].onPress());
    const { iniciarGeofencing } = carregarServico();

    await iniciarGeofencing();

    expect(alerta).toHaveBeenCalledTimes(1);
    expect(alerta.mock.calls[0][1]).toMatch(/sem você abrir o app/);
    expect(Location.requestBackgroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Location.startGeofencingAsync).toHaveBeenCalledTimes(1);
  });

  it("não pede de novo logo depois de o usuário dispensar a explicação", async () => {
    Location.getBackgroundPermissionsAsync.mockResolvedValue({ status: "denied", canAskAgain: true });
    const alerta = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, botoes) => botoes[0].onPress());
    const { iniciarGeofencing } = carregarServico();

    await iniciarGeofencing();
    await iniciarGeofencing();

    expect(alerta).toHaveBeenCalledTimes(1);
    expect(Location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.startGeofencingAsync).not.toHaveBeenCalled();
  });

  it("não insiste quando o sistema já não deixa pedir de novo", async () => {
    Location.getBackgroundPermissionsAsync.mockResolvedValue({ status: "denied", canAskAgain: false });
    const alerta = jest.spyOn(Alert, "alert");
    const { iniciarGeofencing } = carregarServico();

    await iniciarGeofencing();

    expect(alerta).not.toHaveBeenCalled();
    expect(Location.startGeofencingAsync).not.toHaveBeenCalled();
  });

  it("monitora só os 19 hospitais mais próximos mais a região de recálculo (limite do iOS)", async () => {
    // 25 hospitais, do mais distante ao mais próximo (a API não garante a ordem).
    const lista = Array.from({ length: 25 }, (_, i) => ({
      ...hospital(`h${24 - i}`, 150),
      localizacao: { latitude: HOSPITAL_LAT + (24 - i) * 0.001, longitude: HOSPITAL_LON },
    }));
    HospitalService.listar.mockResolvedValue({ content: lista });
    const { iniciarGeofencing, REGIAO_RECALCULO } = carregarServico();

    await iniciarGeofencing();

    const [, regioes] = Location.startGeofencingAsync.mock.calls[0];
    expect(regioes).toHaveLength(20);
    expect(regioes.slice(0, 19).map((r) => r.identifier)).toEqual(
      Array.from({ length: 19 }, (_, i) => `h${i}`)
    );
    const recalculo = regioes[19];
    expect(recalculo).toMatchObject({
      identifier: REGIAO_RECALCULO,
      latitude: HOSPITAL_LAT,
      longitude: HOSPITAL_LON,
      notifyOnEnter: false,
      notifyOnExit: true,
    });
    expect(recalculo.radius).toBeGreaterThanOrEqual(500);
    expect(recalculo.radius).toBeLessThanOrEqual(2500);
    expect(regioes.every((r) => !("distancia" in r))).toBe(true);
  });

  it("ao sair da região de recálculo, refaz a lista em segundo plano sem pedir permissão", async () => {
    HospitalService.listar.mockResolvedValue({ content: [hospital("h1", 150)] });
    const { executarTask, REGIAO_RECALCULO } = carregarServico();

    await executarTask({
      data: {
        eventType: Location.GeofencingEventType.Exit,
        region: { identifier: REGIAO_RECALCULO },
      },
    });

    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.startGeofencingAsync).toHaveBeenCalledTimes(1);
    expect(VisitaService.checkin).not.toHaveBeenCalled();
  });
});

describe("confirmação de entrada", () => {
  const REGIAO = {
    identifier: "hospital-1",
    latitude: HOSPITAL_LAT,
    longitude: HOSPITAL_LON,
  };
  // Onde a pessoa realmente está: ~180 m a nordeste do hospital, fora do geofence.
  const POSICAO_REAL = { latitude: -15.9008, longitude: -48.0731 };

  beforeEach(() => {
    permitirTudo();
    jest.useFakeTimers();
    VisitaService.checkin.mockResolvedValue({ id: "v1" });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function dispararEntrada(executarTask) {
    executarTask({
      data: { eventType: Location.GeofencingEventType.Enter, region: REGIAO },
    });
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);
  }

  it("envia a posição do aparelho, não o centro da região", async () => {
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: POSICAO_REAL });
    const { executarTask } = carregarServico();

    await dispararEntrada(executarTask);

    expect(VisitaService.checkin).toHaveBeenCalledTimes(1);
    expect(VisitaService.checkin).toHaveBeenCalledWith({
      hospitalId: "hospital-1",
      origem: "GEOFENCE",
      posicao: {
        type: "Point",
        coordinates: [POSICAO_REAL.longitude, POSICAO_REAL.latitude],
      },
    });
  });

  it("não confirma a entrada antes dos 2 minutos da RN-01", async () => {
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: POSICAO_REAL });
    const { executarTask } = carregarServico();

    executarTask({
      data: { eventType: Location.GeofencingEventType.Enter, region: REGIAO },
    });
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000 - 1);

    expect(VisitaService.checkin).not.toHaveBeenCalled();
  });

  it("usa a última posição conhecida quando o GPS não responde", async () => {
    Location.getCurrentPositionAsync.mockRejectedValue(new Error("location unavailable"));
    Location.getLastKnownPositionAsync.mockResolvedValue({ coords: POSICAO_REAL });
    const { executarTask } = carregarServico();

    await dispararEntrada(executarTask);

    expect(Location.getLastKnownPositionAsync).toHaveBeenCalledWith({ maxAge: 2 * 60 * 1000 });
    expect(VisitaService.checkin).toHaveBeenCalledWith(
      expect.objectContaining({
        posicao: {
          type: "Point",
          coordinates: [POSICAO_REAL.longitude, POSICAO_REAL.latitude],
        },
      })
    );
  });

  it("não faz check-in quando não há posição alguma para validar", async () => {
    Location.getCurrentPositionAsync.mockRejectedValue(new Error("location unavailable"));
    Location.getLastKnownPositionAsync.mockResolvedValue(null);
    const { executarTask } = carregarServico();

    await dispararEntrada(executarTask);

    expect(VisitaService.checkin).not.toHaveBeenCalled();
  });

  it("cancela a entrada quando a saída chega antes dos 2 minutos", async () => {
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: POSICAO_REAL });
    const { executarTask } = carregarServico();

    executarTask({
      data: { eventType: Location.GeofencingEventType.Enter, region: REGIAO },
    });
    await jest.advanceTimersByTimeAsync(60 * 1000);
    executarTask({
      data: { eventType: Location.GeofencingEventType.Exit, region: REGIAO },
    });
    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(VisitaService.checkin).not.toHaveBeenCalled();
  });

  it("na saída, repassa a duração do checkout para o convite de feedback (RN-01/RN-07)", async () => {
    const { agendarFeedback } = require("../../../screens/feedback/service/FeedbackNotificationService");
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: POSICAO_REAL });
    VisitaService.checkin.mockResolvedValue({ id: "v1", entrada: new Date().toISOString() });
    VisitaService.checkout.mockResolvedValue({ id: "v1", duracaoMinutos: 12 });
    const { executarTask } = carregarServico();

    await dispararEntrada(executarTask); // Enter → +2min → checkin
    executarTask({
      data: { eventType: Location.GeofencingEventType.Exit, region: REGIAO },
    });
    await jest.advanceTimersByTimeAsync(5 * 60 * 1000); // +5min → checkout

    expect(VisitaService.checkout).toHaveBeenCalledWith("v1", {});
    expect(agendarFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ visitaId: "v1", duracaoMinutos: 12 })
    );
  });

  it("check-in e checkout automáticos avisam o observador da visita ativa (heartbeat)", async () => {
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: POSICAO_REAL });
    VisitaService.checkin.mockResolvedValue({ id: "v1", entrada: new Date().toISOString() });
    VisitaService.checkout.mockResolvedValue({ id: "v1", duracaoMinutos: 12 });
    const { executarTask } = carregarServico();
    mockInvalidarVisitaAtiva.mockClear();

    await dispararEntrada(executarTask);
    expect(mockInvalidarVisitaAtiva).toHaveBeenCalledTimes(1);

    executarTask({
      data: { eventType: Location.GeofencingEventType.Exit, region: REGIAO },
    });
    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(mockInvalidarVisitaAtiva).toHaveBeenCalledTimes(2);
  });
});

/**
 * Bug de campo (03/10/2026, Hospital Regional de Ceilândia): com o app fechado, a entrada
 * não era registrada e só acontecia ao abrir o app. O SO acorda o processo no evento de
 * região, mas o suspende (iOS) ou congela/mata (Android) bem antes dos 2 minutos — o
 * `setTimeout` da tolerância nunca disparava em segundo plano.
 */
describe("segundo plano com o app fechado", () => {
  const REGIAO = { identifier: "hospital-1", latitude: HOSPITAL_LAT, longitude: HOSPITAL_LON };
  const POSICAO_REAL = { latitude: HOSPITAL_LAT, longitude: HOSPITAL_LON };

  beforeEach(() => {
    permitirTudo();
    jest.useFakeTimers();
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: POSICAO_REAL });
    VisitaService.checkin.mockResolvedValue({ id: "v1", entrada: new Date().toISOString() });
    VisitaService.checkout.mockResolvedValue({ id: "v1", duracaoMinutos: 130 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /** O processo morre: os timers somem, só o que foi salvo em disco sobrevive. */
  function processoEncerrado(avancoMs) {
    const agora = Date.now();
    // O `clearAllTimers` das fake timers também volta o relógio ao início: o "agora"
    // é lido antes e reposto depois.
    jest.clearAllTimers();
    jest.setSystemTime(agora + avancoMs);
  }

  it("liga o acompanhamento com serviço em primeiro plano assim que entra na região", async () => {
    const { executarTask, ACOMPANHAMENTO_TASK } = carregarServico();

    await executarTask({ data: { eventType: Location.GeofencingEventType.Enter, region: REGIAO } });

    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      ACOMPANHAMENTO_TASK,
      expect.objectContaining({
        foregroundService: expect.objectContaining({ notificationTitle: "Radar Saúde" }),
      })
    );
    expect(VisitaService.checkin).not.toHaveBeenCalled();
  });

  it("confirma a entrada pela leitura de localização em segundo plano, sem depender do timer", async () => {
    const { executarTask } = carregarServico();
    await executarTask({ data: { eventType: Location.GeofencingEventType.Enter, region: REGIAO } });

    processoEncerrado(2 * 60 * 1000);
    const novoProcesso = carregarServico();
    await novoProcesso.executarAcompanhamento({ data: { locations: [] } });

    expect(VisitaService.checkin).toHaveBeenCalledTimes(1);
    expect(VisitaService.checkin).toHaveBeenCalledWith(
      expect.objectContaining({ hospitalId: "hospital-1", origem: "GEOFENCE" })
    );
    // Nada mais pendente: o acompanhamento troca para o modo econômico da visita, sem
    // desligar o serviço em primeiro plano no meio.
    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(acompanhamentoLigado).toBe(true);
    expect(Location.startLocationUpdatesAsync).toHaveBeenLastCalledWith(
      novoProcesso.ACOMPANHAMENTO_TASK,
      expect.objectContaining({ timeInterval: 5 * 60 * 1000 })
    );
  });

  it("não confirma a entrada por leitura que chega antes dos 2 minutos", async () => {
    const { executarTask } = carregarServico();
    await executarTask({ data: { eventType: Location.GeofencingEventType.Enter, region: REGIAO } });

    processoEncerrado(60 * 1000);
    await carregarServico().executarAcompanhamento({ data: { locations: [] } });

    expect(VisitaService.checkin).not.toHaveBeenCalled();
    expect(acompanhamentoLigado).toBe(true);
  });

  it("faz o checkout mesmo quando a saída chega a um processo novo", async () => {
    const primeiro = carregarServico();
    await primeiro.executarTask({ data: { eventType: Location.GeofencingEventType.Enter, region: REGIAO } });
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(VisitaService.checkin).toHaveBeenCalledTimes(1);
    expect(JSON.parse(await AsyncStorage.getItem("@saude_monitor:geofencing")).visita).toMatchObject({
      id: "v1",
      hospitalId: "hospital-1",
    });

    // Duas horas depois, o SO entrega a saída a um processo recém-criado.
    processoEncerrado(2 * 60 * 60 * 1000);
    const segundo = carregarServico();
    await segundo.executarTask({ data: { eventType: Location.GeofencingEventType.Exit, region: REGIAO } });
    expect(VisitaService.checkout).not.toHaveBeenCalled();

    processoEncerrado(5 * 60 * 1000);
    await carregarServico().executarAcompanhamento({ data: { locations: [] } });

    expect(VisitaService.checkout).toHaveBeenCalledWith("v1", {});
    expect(VisitaService.checkout).toHaveBeenCalledTimes(1);
  });

  it("confirma ao abrir o app a pendência que venceu enquanto ele estava fechado", async () => {
    const { executarTask } = carregarServico();
    await executarTask({ data: { eventType: Location.GeofencingEventType.Enter, region: REGIAO } });
    // Sem o acompanhamento (ex.: o SO recusou o serviço em primeiro plano).
    processoEncerrado(10 * 60 * 1000);
    HospitalService.listar.mockResolvedValue({ content: [] });

    await carregarServico().iniciarGeofencing();

    expect(VisitaService.checkin).toHaveBeenCalledTimes(1);
  });

  it("a saída da região de outro hospital não encerra a visita em andamento", async () => {
    const { executarTask, sincronizarVisitaAtiva } = carregarServico();
    await sincronizarVisitaAtiva("v1", "2026-10-03T10:00:00.000Z", "hospital-1");

    await executarTask({
      data: { eventType: Location.GeofencingEventType.Exit, region: { identifier: "vizinho" } },
    });
    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(VisitaService.checkout).not.toHaveBeenCalled();
  });

  it("o mesmo evento entregue duas vezes gera um só check-in", async () => {
    const { executarTask } = carregarServico();
    const evento = { data: { eventType: Location.GeofencingEventType.Enter, region: REGIAO } };

    await Promise.all([executarTask(evento), executarTask(evento)]);
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);

    expect(VisitaService.checkin).toHaveBeenCalledTimes(1);
  });

  it("pararGeofencing (logout) apaga a visita guardada e desliga o acompanhamento", async () => {
    const { executarTask, pararGeofencing } = carregarServico();
    await executarTask({ data: { eventType: Location.GeofencingEventType.Enter, region: REGIAO } });
    expect(acompanhamentoLigado).toBe(true);

    await pararGeofencing();
    processoEncerrado(5 * 60 * 1000);
    await carregarServico().executarAcompanhamento({ data: { locations: [] } });

    expect(acompanhamentoLigado).toBe(false);
    expect(Location.stopGeofencingAsync).toHaveBeenCalled();
    expect(VisitaService.checkin).not.toHaveBeenCalled();
  });
});

describe("falhas e casos de borda", () => {
  const REGIAO = { identifier: "hospital-1", latitude: HOSPITAL_LAT, longitude: HOSPITAL_LON };

  beforeEach(() => {
    permitirTudo();
    jest.useFakeTimers();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    Location.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: HOSPITAL_LAT, longitude: HOSPITAL_LON },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const entrar = (executarTask) =>
    executarTask({ data: { eventType: Location.GeofencingEventType.Enter, region: REGIAO } });
  const sair = (executarTask) =>
    executarTask({ data: { eventType: Location.GeofencingEventType.Exit, region: REGIAO } });

  it("check-in sem internet fica na fila offline e não marca visita local", async () => {
    VisitaService.checkin.mockRejectedValue(Object.assign(new Error("offline"), { enfileirado: true }));
    const { executarTask } = carregarServico();

    await entrar(executarTask);
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);

    expect(VisitaService.checkin).toHaveBeenCalledTimes(1);
    expect(JSON.parse(await AsyncStorage.getItem("@saude_monitor:geofencing")).visita).toBeNull();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("conflito de geofences (409) é silencioso; outros erros são registrados", async () => {
    VisitaService.checkin.mockRejectedValue(Object.assign(new Error("conflito"), { status: 409 }));
    const { executarTask } = carregarServico();
    await entrar(executarTask);
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(console.warn).not.toHaveBeenCalled();

    VisitaService.checkin.mockRejectedValue(Object.assign(new Error("500"), { status: 500 }));
    await entrar(executarTask);
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(console.warn).toHaveBeenCalledWith(
      "GeofencingTaskService: falha ao confirmar entrada",
      "500"
    );
  });

  it("checkout sem internet encerra a visita localmente com a duração calculada", async () => {
    const { agendarFeedback } = require("../../../screens/feedback/service/FeedbackNotificationService");
    VisitaService.checkout.mockRejectedValue(Object.assign(new Error("offline"), { enfileirado: true }));
    const { executarTask, sincronizarVisitaAtiva } = carregarServico();
    await sincronizarVisitaAtiva("v9", new Date(Date.now() - 30 * 60 * 1000).toISOString(), "hospital-1");

    await sair(executarTask);
    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(agendarFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ visitaId: "v9", hospitalId: "hospital-1", duracaoMinutos: 35 })
    );
    expect(JSON.parse(await AsyncStorage.getItem("@saude_monitor:geofencing")).visita).toBeNull();
  });

  it("falha ao agendar o feedback é registrada e não impede encerrar a visita local", async () => {
    const { agendarFeedback } = require("../../../screens/feedback/service/FeedbackNotificationService");
    agendarFeedback.mockRejectedValueOnce(new Error("disco cheio"));
    VisitaService.checkout.mockResolvedValue({ id: "v9", duracaoMinutos: 20 });
    const { executarTask, sincronizarVisitaAtiva } = carregarServico();
    await sincronizarVisitaAtiva("v9", null, "hospital-1");

    await sair(executarTask);
    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(console.warn).toHaveBeenCalledWith(
      "GeofencingTaskService: falha ao agendar o feedback",
      "disco cheio"
    );
    expect(JSON.parse(await AsyncStorage.getItem("@saude_monitor:geofencing")).visita).toBeNull();
  });

  it("checkout com erro do servidor mantém a visita para nova tentativa", async () => {
    VisitaService.checkout.mockRejectedValue(new Error("500"));
    const { executarTask, sincronizarVisitaAtiva } = carregarServico();
    await sincronizarVisitaAtiva("v9", null, "hospital-1");

    await sair(executarTask);
    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(VisitaService.checkout).toHaveBeenCalledWith("v9", {});
    expect(JSON.parse(await AsyncStorage.getItem("@saude_monitor:geofencing")).visita).toMatchObject({
      id: "v9",
    });
  });

  it("se o SO recusa o acompanhamento, o timer ainda confirma a entrada", async () => {
    Location.startLocationUpdatesAsync.mockRejectedValue(new Error("ForegroundServiceStartNotAllowed"));
    VisitaService.checkin.mockResolvedValue({ id: "v1" });
    const { executarTask } = carregarServico();

    await entrar(executarTask);
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);

    expect(console.warn).toHaveBeenCalledWith(
      "GeofencingTaskService: acompanhamento indisponível",
      "ForegroundServiceStartNotAllowed"
    );
    expect(VisitaService.checkin).toHaveBeenCalledTimes(1);
  });

  it("ignora eventos com erro, sem região ou de estado corrompido", async () => {
    await AsyncStorage.setItem("@saude_monitor:geofencing", "{corrompido");
    const { executarTask, executarAcompanhamento } = carregarServico();

    await executarTask({ error: new Error("x"), data: {} });
    await executarTask({ data: { eventType: Location.GeofencingEventType.Enter } });
    await executarAcompanhamento({ error: new Error("x") });
    await entrar(executarTask);

    expect(JSON.parse(await AsyncStorage.getItem("@saude_monitor:geofencing")).entradas).toHaveProperty(
      "hospital-1"
    );
  });

  it("sincronizar a mesma visita preserva hospital e entrada já conhecidos", async () => {
    const { sincronizarVisitaAtiva } = carregarServico();
    await sincronizarVisitaAtiva("v1", "2026-10-03T10:00:00.000Z", "hospital-1");
    await sincronizarVisitaAtiva("v1");

    expect(JSON.parse(await AsyncStorage.getItem("@saude_monitor:geofencing")).visita).toEqual({
      id: "v1",
      hospitalId: "hospital-1",
      entrada: "2026-10-03T10:00:00.000Z",
    });
  });

  it("sem permissão de primeiro plano ou sem GPS/servidor, não inicia o monitoramento", async () => {
    const { iniciarGeofencing } = carregarServico();

    Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: "denied" });
    await iniciarGeofencing();
    Location.getCurrentPositionAsync.mockRejectedValueOnce(new Error("sem gps"));
    await iniciarGeofencing();
    HospitalService.listar.mockRejectedValueOnce(new Error("500"));
    await iniciarGeofencing();

    expect(Location.startGeofencingAsync).not.toHaveBeenCalled();
  });

  it("sem hospital por perto, monitora só a região de recálculo, com o raio máximo", async () => {
    HospitalService.listar.mockResolvedValue({ content: [{ id: "sem-local" }] });
    const { iniciarGeofencing, REGIAO_RECALCULO } = carregarServico();

    await iniciarGeofencing();

    const [, regioes] = Location.startGeofencingAsync.mock.calls[0];
    expect(regioes).toEqual([expect.objectContaining({ identifier: REGIAO_RECALCULO, radius: 2500 })]);
  });

  it("recálculo em segundo plano sem internet ainda registra uma região de recálculo curta", async () => {
    HospitalService.listar.mockRejectedValue(new Error("sem internet"));
    const { executarTask, REGIAO_RECALCULO } = carregarServico();

    await executarTask({
      data: { eventType: Location.GeofencingEventType.Exit, region: { identifier: REGIAO_RECALCULO } },
    });

    const [, regioes] = Location.startGeofencingAsync.mock.calls[0];
    expect(regioes).toEqual([expect.objectContaining({ identifier: REGIAO_RECALCULO, radius: 500 })]);
  });

  it("uma saída antiga do hospital A não encerra a visita nova no hospital B", async () => {
    VisitaService.checkin.mockResolvedValue({ id: "vB" });
    const { executarTask, sincronizarVisitaAtiva } = carregarServico();
    await sincronizarVisitaAtiva("vA", null, "hospital-A");

    await executarTask({
      data: { eventType: Location.GeofencingEventType.Exit, region: { identifier: "hospital-A" } },
    });
    await executarTask({
      data: { eventType: Location.GeofencingEventType.Enter, region: { identifier: "hospital-B" } },
    });
    // Aos 2 min o check-in em B troca a visita guardada; aos 5 min vence a saída de A.
    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(VisitaService.checkin).toHaveBeenCalledWith(expect.objectContaining({ hospitalId: "hospital-B" }));
    expect(VisitaService.checkout).not.toHaveBeenCalled();
    expect(JSON.parse(await AsyncStorage.getItem("@saude_monitor:geofencing")).visita).toMatchObject({
      id: "vB",
      hospitalId: "hospital-B",
    });
  });

  it("checkout recusado com 404 esquece a visita guardada", async () => {
    VisitaService.checkout.mockRejectedValue(Object.assign(new Error("404"), { status: 404 }));
    const { executarTask, sincronizarVisitaAtiva } = carregarServico();
    await sincronizarVisitaAtiva("v9", null, "hospital-1");

    await sair(executarTask);
    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(JSON.parse(await AsyncStorage.getItem("@saude_monitor:geofencing")).visita).toBeNull();
    expect(mockInvalidarVisitaAtiva).toHaveBeenCalled();
  });

  it("entrada sem sinal de GPS é tentada de novo até haver posição", async () => {
    VisitaService.checkin.mockResolvedValue({ id: "v1" });
    Location.getCurrentPositionAsync.mockRejectedValue(new Error("sem sinal"));
    Location.getLastKnownPositionAsync.mockResolvedValue(null);
    const { executarTask } = carregarServico();

    await entrar(executarTask);
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(VisitaService.checkin).not.toHaveBeenCalled();
    expect(acompanhamentoLigado).toBe(true);

    Location.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: HOSPITAL_LAT, longitude: HOSPITAL_LON },
    });
    await jest.advanceTimersByTimeAsync(60 * 1000);

    expect(VisitaService.checkin).toHaveBeenCalledTimes(1);
    // Segue ligado, agora só para o sinal da visita aberta.
    expect(Location.startLocationUpdatesAsync).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ timeInterval: 5 * 60 * 1000 })
    );
  });

  it("desiste da entrada sem GPS depois de 30 minutos", async () => {
    Location.getCurrentPositionAsync.mockRejectedValue(new Error("sem sinal"));
    Location.getLastKnownPositionAsync.mockResolvedValue(null);
    const { executarTask } = carregarServico();

    await entrar(executarTask);
    await jest.advanceTimersByTimeAsync(31 * 60 * 1000);

    expect(acompanhamentoLigado).toBe(false);
    expect(JSON.parse(await AsyncStorage.getItem("@saude_monitor:geofencing")).entradas).toEqual({});
  });

  it("check-in que termina depois do logout não regrava a visita", async () => {
    let responder;
    VisitaService.checkin.mockReturnValue(new Promise((r) => { responder = r; }));
    const { executarTask, pararGeofencing } = carregarServico();

    await entrar(executarTask);
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);
    await pararGeofencing();
    responder({ id: "v1" });
    await jest.advanceTimersByTimeAsync(0);

    expect(JSON.parse(await AsyncStorage.getItem("@saude_monitor:geofencing")).visita).toBeNull();
  });

  it("no iOS a explicação fala da opção \"Sempre\"", async () => {
    const { Platform } = require("react-native");
    const original = Platform.OS;
    Platform.OS = "ios";
    Location.getBackgroundPermissionsAsync.mockResolvedValue({ status: "denied", canAskAgain: true });
    const alerta = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, _b, opcoes) => opcoes.onDismiss());
    try {
      const { iniciarGeofencing } = carregarServico();
      await iniciarGeofencing();
    } finally {
      Platform.OS = original;
    }

    expect(alerta.mock.calls[0][1]).toMatch(/"Sempre"/);
    expect(Location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
  });
});

function avancar(ms) {
  jest.setSystemTime(Date.now() + ms);
}

describe("sinal da visita em segundo plano (RN-06)", () => {
  const LEITURA = [{ coords: { latitude: HOSPITAL_LAT, longitude: HOSPITAL_LON } }];
  const POSICAO = { type: "Point", coordinates: [HOSPITAL_LON, HOSPITAL_LAT] };

  beforeEach(() => {
    permitirTudo();
    jest.useFakeTimers();
    VisitaService.heartbeat.mockReset();
    VisitaService.heartbeat.mockResolvedValue({ status: "EM_ATENDIMENTO" });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("visita aberta liga o acompanhamento econômico com a notificação de visita", async () => {
    const { sincronizarVisitaAtiva, ACOMPANHAMENTO_TASK } = carregarServico();

    await sincronizarVisitaAtiva("v1", null, "hospital-1");

    expect(acompanhamentoLigado).toBe(true);
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      ACOMPANHAMENTO_TASK,
      expect.objectContaining({
        accuracy: "Balanced",
        timeInterval: 5 * 60 * 1000,
        foregroundService: expect.objectContaining({
          notificationBody: expect.stringContaining("Visita em andamento"),
        }),
      })
    );
  });

  it("chamar de novo com a mesma visita não religa o acompanhamento", async () => {
    const { sincronizarVisitaAtiva } = carregarServico();

    await sincronizarVisitaAtiva("v1", null, "hospital-1");
    await sincronizarVisitaAtiva("v1", null, "hospital-1");

    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledTimes(1);
    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it("leitura com o app fechado manda o heartbeat com a posição da própria leitura", async () => {
    await carregarServico().sincronizarVisitaAtiva("v1", null, "hospital-1");

    // O SO entrega a leitura a um processo recém-criado.
    await carregarServico().executarAcompanhamento({ data: { locations: LEITURA } });

    expect(VisitaService.heartbeat).toHaveBeenCalledWith("v1", POSICAO);
  });

  it("manda no máximo um sinal a cada ~10 minutos", async () => {
    const { sincronizarVisitaAtiva, executarAcompanhamento } = carregarServico();
    await sincronizarVisitaAtiva("v1", null, "hospital-1");

    await executarAcompanhamento({ data: { locations: LEITURA } });
    avancar(5 * 60 * 1000);
    await executarAcompanhamento({ data: { locations: LEITURA } });
    expect(VisitaService.heartbeat).toHaveBeenCalledTimes(1);

    avancar(5 * 60 * 1000);
    await executarAcompanhamento({ data: { locations: LEITURA } });
    expect(VisitaService.heartbeat).toHaveBeenCalledTimes(2);
  });

  it("leituras simultâneas não duplicam o sinal", async () => {
    const { sincronizarVisitaAtiva, enviarSinalDaVisita } = carregarServico();
    await sincronizarVisitaAtiva("v1", null, "hospital-1");

    await Promise.all([enviarSinalDaVisita(LEITURA), enviarSinalDaVisita(LEITURA)]);

    expect(VisitaService.heartbeat).toHaveBeenCalledTimes(1);
  });

  it("leitura sem coordenadas ainda manda o sinal, sem posição", async () => {
    const { sincronizarVisitaAtiva, executarAcompanhamento } = carregarServico();
    await sincronizarVisitaAtiva("v1", null, "hospital-1");

    await executarAcompanhamento({ data: {} });

    expect(VisitaService.heartbeat).toHaveBeenCalledWith("v1", undefined);
  });

  it("visita nova manda o sinal logo, sem esperar o intervalo da anterior", async () => {
    const { sincronizarVisitaAtiva, enviarSinalDaVisita } = carregarServico();
    await sincronizarVisitaAtiva("v1", null, "hospital-1");
    await enviarSinalDaVisita(LEITURA);

    await sincronizarVisitaAtiva("v2", null, "hospital-2");
    await enviarSinalDaVisita(LEITURA);

    expect(VisitaService.heartbeat).toHaveBeenLastCalledWith("v2", POSICAO);
    expect(VisitaService.heartbeat).toHaveBeenCalledTimes(2);
  });

  it("sem visita aberta não manda sinal e mantém o GPS desligado", async () => {
    const { enviarSinalDaVisita, sincronizarVisitaAtiva } = carregarServico();
    await sincronizarVisitaAtiva(null);

    await enviarSinalDaVisita(LEITURA);

    expect(VisitaService.heartbeat).not.toHaveBeenCalled();
    expect(acompanhamentoLigado).toBe(false);
  });

  it("falha de rede desfaz a reserva e a leitura seguinte tenta de novo", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    VisitaService.heartbeat.mockRejectedValueOnce(new Error("Network request failed"));
    const { sincronizarVisitaAtiva, enviarSinalDaVisita } = carregarServico();
    await sincronizarVisitaAtiva("v1", null, "hospital-1");

    await enviarSinalDaVisita(LEITURA);
    avancar(60 * 1000);
    await enviarSinalDaVisita(LEITURA);

    expect(VisitaService.heartbeat).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith(
      "GeofencingTaskService: falha ao enviar o sinal da visita",
      "Network request failed"
    );
    console.warn.mockRestore();
  });

  it.each([404, 409])("visita fechada no servidor (%i) é esquecida e o acompanhamento desliga", async (status) => {
    VisitaService.heartbeat.mockRejectedValueOnce(Object.assign(new Error("fechada"), { status }));
    const { sincronizarVisitaAtiva, enviarSinalDaVisita } = carregarServico();
    await sincronizarVisitaAtiva("v1", null, "hospital-1");

    await enviarSinalDaVisita(LEITURA);

    const estado = JSON.parse(await AsyncStorage.getItem("@saude_monitor:geofencing"));
    expect(estado.visita).toBeNull();
    expect(estado.sinal).toBeNull();
    expect(acompanhamentoLigado).toBe(false);
  });

  it("pendência de saída durante a visita volta ao modo de leitura a cada 30 s", async () => {
    const { sincronizarVisitaAtiva, executarTask } = carregarServico();
    await sincronizarVisitaAtiva("v1", null, "hospital-1");

    await executarTask({
      data: { eventType: Location.GeofencingEventType.Exit, region: { identifier: "hospital-1" } },
    });

    expect(Location.startLocationUpdatesAsync).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ accuracy: "Balanced", timeInterval: 30 * 1000 })
    );
    expect(acompanhamentoLigado).toBe(true);
  });

  it("estado gravado por versão anterior, sem modo, religa no modo certo", async () => {
    await AsyncStorage.setItem(
      "@saude_monitor:geofencing",
      JSON.stringify({ visita: { id: "v1", hospitalId: "hospital-1" }, entradas: {}, saidas: {} })
    );
    acompanhamentoLigado = true;

    await carregarServico().executarAcompanhamento({ data: { locations: LEITURA } });

    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ timeInterval: 5 * 60 * 1000 })
    );
    expect(JSON.parse(await AsyncStorage.getItem("@saude_monitor:geofencing")).modo).toBe("visita");
  });
});
