/**
 * Monitoramento de geolocalização (Épico 02) — GeolocalizacaoProvider.
 * Verifica os fluxos de permissão (negada/concedida) e a atualização de coordenadas
 * via watchPositionAsync (RN-05, E2-01).
 */
import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import * as Location from "expo-location";
import {
  GeolocalizacaoProvider,
  useGeolocalizacao,
} from "../../../screens/geolocalizacao/service/GeoLocalizacaoService";

const wrapper = ({ children }) => <GeolocalizacaoProvider>{children}</GeolocalizacaoProvider>;

describe("GeoLocalizacaoService (Épico 02)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("permissão negada define erro e não monitora", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.DENIED,
    });

    const { result } = renderHook(() => useGeolocalizacao(), { wrapper });

    await act(async () => {
      // o provider captura a exceção de permissão e apenas expõe o erro via estado
      await result.current.iniciarMonitoramento();
    });

    expect(result.current.erro).toBe("Permissao de localizacao negada.");
    expect(result.current.permissaoConcedida).toBe(false);
    expect(Location.watchPositionAsync).not.toHaveBeenCalled();
  });

  test("permissão concedida monitora e atualiza coordenadas", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
    });
    Location.watchPositionAsync.mockResolvedValue({ remove: jest.fn() });

    const { result } = renderHook(() => useGeolocalizacao(), { wrapper });

    await act(async () => {
      await result.current.iniciarMonitoramento();
    });

    expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1);
    // configuração: melhor precisão, 2000ms, 3m de distância
    const [opcoes] = Location.watchPositionAsync.mock.calls[0];
    expect(opcoes.accuracy).toBe(Location.Accuracy.BestForNavigation);
    expect(opcoes.timeInterval).toBe(2000);
    expect(opcoes.distanceInterval).toBe(3);
    expect(result.current.permissaoConcedida).toBe(true);

    // dispara o callback de posição
    const callback = Location.watchPositionAsync.mock.calls[0][1];
    await act(async () => {
      callback({
        coords: { latitude: -15.79, longitude: -47.88, accuracy: 5 },
        timestamp: 123456,
      });
    });

    expect(result.current.coordenadas.latitude).toBe(-15.79);
    expect(result.current.coordenadas.longitude).toBe(-47.88);
    expect(result.current.carregando).toBe(false);
  });
});
