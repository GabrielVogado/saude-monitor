/**
 * Posição do aparelho para o check-in manual (SEG-01): só com permissão já concedida,
 * sem diálogo, e sem travar o toque quando o GPS não responde.
 */
import * as Location from "expo-location";
import { obterPosicaoParaCheckinManual } from "../../../screens/visitas/service/PosicaoAparelho";

const coords = { latitude: -15.9023, longitude: -48.0742 };
const esperado = { type: "Point", coordinates: [-48.0742, -15.9023] };

describe("obterPosicaoParaCheckinManual", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Location.getForegroundPermissionsAsync.mockResolvedValue({ granted: true });
    Location.getLastKnownPositionAsync.mockResolvedValue(null);
    Location.getCurrentPositionAsync.mockResolvedValue({ coords });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("sem permissão não lê o GPS nem pede permissão", async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({ granted: false });

    await expect(obterPosicaoParaCheckinManual()).resolves.toBeUndefined();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  test("usa a última leitura recente sem acionar o GPS", async () => {
    Location.getLastKnownPositionAsync.mockResolvedValue({ coords });

    await expect(obterPosicaoParaCheckinManual()).resolves.toEqual(esperado);
    expect(Location.getLastKnownPositionAsync).toHaveBeenCalledWith({ maxAge: 120000 });
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  test("sem leitura recente, lê o GPS ao vivo", async () => {
    await expect(obterPosicaoParaCheckinManual()).resolves.toEqual(esperado);
  });

  test("GPS que não responde em 5 s não trava o check-in", async () => {
    jest.useFakeTimers();
    Location.getCurrentPositionAsync.mockReturnValue(new Promise(() => {}));

    const resultado = obterPosicaoParaCheckinManual();
    await jest.advanceTimersByTimeAsync(5000);

    await expect(resultado).resolves.toBeUndefined();
  });

  test("erro do módulo de localização vira 'sem posição'", async () => {
    Location.getForegroundPermissionsAsync.mockRejectedValue(new Error("indisponível"));

    await expect(obterPosicaoParaCheckinManual()).resolves.toBeUndefined();
  });
});
