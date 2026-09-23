/**
 * Tela Início (E6-01) — sincronização silenciosa da visita ativa.
 *
 * A Home não tem UI de visita ativa, mas `carregarVisitaAtiva` alimenta
 * `sincronizarVisitaAtiva`/heartbeat (E2-09) a cada foco. Sem teste, uma
 * oscilação de conexão zerando `visitaAtivaId` por engano pararia o heartbeat
 * de uma visita real em silêncio — sem nenhuma tela mostrando o defeito.
 */
import React from "react";
import { render, waitFor, act } from "@testing-library/react-native";
import HomeScreen from "../../../screens/home/view/HomeScreen";
import VisitaService from "../../../screens/visitas/service/VisitaService";
import {
  iniciarGeofencing,
  sincronizarVisitaAtiva,
} from "../../../screens/visitas/service/GeofencingTaskService";
import { iniciarHeartbeat, pararHeartbeat } from "../../../screens/visitas/service/HeartbeatService";
import { ErroSemInternet } from "../../../config/http";

jest.mock("../../../screens/visitas/service/VisitaService");
jest.mock("../../../screens/visitas/service/GeofencingTaskService");
jest.mock("../../../screens/visitas/service/HeartbeatService");

// Guarda o callback de foco mais recente para o teste poder simular um segundo
// foco da Home (ex.: voltar de outra aba) sem desmontar o componente.
let callbackDeFoco = null;

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback) => {
    const React = require("react");
    callbackDeFoco = callback;
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
}));

async function refocarTela() {
  await act(async () => {
    callbackDeFoco();
  });
}

describe("HomeScreen — sincronização da visita ativa sobrevive a uma oscilação de conexão", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    iniciarGeofencing.mockResolvedValue(undefined);
  });

  test("um refoco sem internet não para o heartbeat de uma visita geofence real", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({ visita: { id: "v1" } });

    render(<HomeScreen />);
    await waitFor(() => expect(iniciarHeartbeat).toHaveBeenCalledWith("v1"));
    pararHeartbeat.mockClear();

    VisitaService.buscarAtiva.mockRejectedValue(new ErroSemInternet("http://exemplo"));
    await refocarTela();

    expect(pararHeartbeat).not.toHaveBeenCalled();
    expect(sincronizarVisitaAtiva).toHaveBeenLastCalledWith("v1");
  });

  test("um refoco com erro real ainda limpa a visita e para o heartbeat", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({ visita: { id: "v1" } });

    render(<HomeScreen />);
    await waitFor(() => expect(iniciarHeartbeat).toHaveBeenCalledWith("v1"));

    VisitaService.buscarAtiva.mockRejectedValue(new Error("Sessão expirada. Faça login novamente."));
    await refocarTela();

    await waitFor(() => expect(pararHeartbeat).toHaveBeenCalled());
    expect(sincronizarVisitaAtiva).toHaveBeenLastCalledWith(null);
  });
});
