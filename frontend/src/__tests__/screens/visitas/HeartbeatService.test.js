/**
 * Heartbeat da visita ativa (Épico 02 / RN-23) — a cada 30 min envia sinal de vida;
 * envia posição quando disponível, senão envia apenas o heartbeat.
 */
import * as Location from "expo-location";
import VisitaService from "../../../screens/visitas/service/VisitaService";
import { iniciarHeartbeat, pararHeartbeat } from "../../../screens/visitas/service/HeartbeatService";

jest.mock("../../../screens/visitas/service/VisitaService");

const INTERVALO_30MIN = 30 * 60 * 1000;

describe("HeartbeatService (Épico 02)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    VisitaService.heartbeat.mockResolvedValue({});
  });

  afterEach(() => {
    pararHeartbeat();
    jest.useRealTimers();
  });

  test("inicia heartbeat de 30min e envia com posição (RN-23)", async () => {
    Location.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: -15.79, longitude: -47.88 },
    });

    iniciarHeartbeat("v1");
    await jest.advanceTimersByTimeAsync(INTERVALO_30MIN);

    expect(VisitaService.heartbeat).toHaveBeenCalledTimes(1);
    const [id, posicao] = VisitaService.heartbeat.mock.calls[0];
    expect(id).toBe("v1");
    expect(posicao.type).toBe("Point");
    expect(posicao.coordinates).toEqual([-47.88, -15.79]);
  });

  test("sem GPS envia heartbeat sem posição", async () => {
    Location.getCurrentPositionAsync.mockRejectedValue(new Error("sem gps"));

    iniciarHeartbeat("v1");
    await jest.advanceTimersByTimeAsync(INTERVALO_30MIN);

    expect(VisitaService.heartbeat).toHaveBeenCalledTimes(1);
    // segundo argumento undefined => sem posição
    expect(VisitaService.heartbeat.mock.calls[0][1]).toBeUndefined();
  });

  test("pararHeartbeat encerra o ciclo (checkout não envia mais sinais)", async () => {
    iniciarHeartbeat("v1");
    await jest.advanceTimersByTimeAsync(INTERVALO_30MIN);
    expect(VisitaService.heartbeat).toHaveBeenCalledTimes(1);

    pararHeartbeat();
    await jest.advanceTimersByTimeAsync(INTERVALO_30MIN * 2);
    expect(VisitaService.heartbeat).toHaveBeenCalledTimes(1);
  });

  test("iniciarHeartbeat sem visita não dispara", async () => {
    iniciarHeartbeat(null);
    await jest.advanceTimersByTimeAsync(INTERVALO_30MIN * 2);
    expect(VisitaService.heartbeat).not.toHaveBeenCalled();
  });
});
