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
}));

jest.mock("../../../screens/hospitais/service/HospitalService", () => ({
  __esModule: true,
  default: { listar: jest.fn() },
}));

jest.mock("../../../screens/visitas/service/VisitaService", () => ({
  __esModule: true,
  default: { checkin: jest.fn(), checkout: jest.fn(), buscarAtiva: jest.fn() },
}));

jest.mock("../../../screens/feedback/service/FeedbackNotificationService", () => ({
  __esModule: true,
  agendarFeedback: jest.fn(),
}));

const HOSPITAL_LAT = -15.9023;
const HOSPITAL_LON = -48.0742;

/** Carrega o módulo do zero e devolve a API pública + a task registrada no SO. */
function carregarServico() {
  let servico;
  jest.isolateModules(() => {
    servico = require("../../../screens/visitas/service/GeofencingTaskService");
  });
  const chamada = TaskManager.defineTask.mock.calls.at(-1);
  return { ...servico, executarTask: chamada[1] };
}

function permitirTudo() {
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
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
    expect(regioes.map((r) => r.radius)).toEqual([100, 100, 150]);
  });

  it("cai no piso quando o hospital não informa raio", async () => {
    HospitalService.listar.mockResolvedValue({
      content: [hospital("sem-raio", undefined), hospital("raio-invalido", 0)],
    });
    const { iniciarGeofencing } = carregarServico();

    await iniciarGeofencing();

    const [, regioes] = Location.startGeofencingAsync.mock.calls[0];
    expect(regioes.map((r) => r.radius)).toEqual([100, 100]);
  });

  it("não monitora nada sem permissão de background", async () => {
    Location.requestBackgroundPermissionsAsync.mockResolvedValue({ status: "denied" });
    const { iniciarGeofencing } = carregarServico();

    await iniciarGeofencing();

    expect(Location.startGeofencingAsync).not.toHaveBeenCalled();
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
});
