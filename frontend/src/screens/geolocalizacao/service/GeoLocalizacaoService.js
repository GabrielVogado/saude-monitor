import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Location from "expo-location";

const GeolocalizacaoContext = createContext(undefined);

const ERRO_PERMISSAO = "Permissao de localizacao negada.";
const ERRO_GPS = "Nao foi possivel obter a localizacao em tempo real.";

export function GeolocalizacaoProvider({ children }) {
  const [coordenadas, setCoordenadas] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [permissaoConcedida, setPermissaoConcedida] = useState(false);
  const [erro, setErro] = useState(null);

  const subscriptionRef = useRef(null);

  const atualizarPosicao = useCallback((coords, timestamp) => {
    setCoordenadas({
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      timestamp,
    });
    setErro(null);
  }, []);

  const pararMonitoramento = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
  }, []);

  const solicitarPermissao = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const concedida = status === Location.PermissionStatus.GRANTED;

    setPermissaoConcedida(concedida);

    if (!concedida) {
      setErro(ERRO_PERMISSAO);
      throw new Error(ERRO_PERMISSAO);
    }
  }, []);

  const iniciarMonitoramento = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    pararMonitoramento();

    try {
      await solicitarPermissao();

      // Expo Location atende Android/iOS/Web com a mesma API.
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 3,
        },
        (location) => {
          atualizarPosicao(location.coords, location.timestamp);
          setCarregando(false);
        }
      );
    } catch (error) {
      setErro(error instanceof Error ? error.message : ERRO_GPS);
      setCarregando(false);
    }
  }, [atualizarPosicao, pararMonitoramento, solicitarPermissao]);

  useEffect(() => {
    return () => {
      pararMonitoramento();
    };
  }, [pararMonitoramento]);

  const value = useMemo(
    () => ({
      coordenadas,
      carregando,
      permissaoConcedida,
      erro,
      iniciarMonitoramento,
      pararMonitoramento,
    }),
    [carregando, coordenadas, erro, iniciarMonitoramento, pararMonitoramento, permissaoConcedida]
  );

  return React.createElement(GeolocalizacaoContext.Provider, { value }, children);
}

export function useGeolocalizacao() {
  const context = useContext(GeolocalizacaoContext);

  if (!context) {
    throw new Error("useGeolocalizacao deve ser usado dentro de GeolocalizacaoProvider");
  }

  return context;
}

