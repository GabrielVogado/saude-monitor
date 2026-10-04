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
// O card de avaliações pendentes tem teste próprio (FeedbacksPendentesCard.test.js).
jest.mock("../../../screens/feedback/view/FeedbacksPendentesCard", () => () => null);

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
    sincronizarVisitaAtiva.mockResolvedValue(undefined);
  });

  test("um refoco sem internet não para o heartbeat de uma visita geofence real", async () => {
    // Reidrata id + entrada: a entrada alimenta o cálculo de duração no checkout offline
    // do geofence (RN-01/RN-07), então é repassada ao sincronizarVisitaAtiva.
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", entrada: "2026-09-28T10:00:00.000Z", hospitalId: "h1" },
    });

    render(<HomeScreen />);
    await waitFor(() => expect(iniciarHeartbeat).toHaveBeenCalledWith("v1"));
    pararHeartbeat.mockClear();
    sincronizarVisitaAtiva.mockClear();

    VisitaService.buscarAtiva.mockRejectedValue(new ErroSemInternet("http://exemplo"));
    await refocarTela();

    expect(pararHeartbeat).not.toHaveBeenCalled();
    // O geofencing guarda a visita em disco; sem resposta do servidor, nada a sincronizar.
    expect(sincronizarVisitaAtiva).not.toHaveBeenCalled();
  });

  test("repassa id, entrada e hospital da visita reidratada ao geofencing", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", entrada: "2026-09-28T10:00:00.000Z", hospitalId: "h1" },
    });

    render(<HomeScreen />);

    await waitFor(() =>
      expect(sincronizarVisitaAtiva).toHaveBeenCalledWith("v1", "2026-09-28T10:00:00.000Z", "h1")
    );
  });

  test("sem visita ativa no servidor, limpa a visita guardada pelo geofencing", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({ visita: null });

    render(<HomeScreen />);

    await waitFor(() => expect(sincronizarVisitaAtiva).toHaveBeenCalledWith(null, null, null));
  });

  test("um refoco com erro real para o heartbeat, mas não apaga a visita do geofencing", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", entrada: "2026-09-28T10:00:00.000Z" },
    });

    render(<HomeScreen />);
    await waitFor(() => expect(iniciarHeartbeat).toHaveBeenCalledWith("v1"));
    sincronizarVisitaAtiva.mockClear();

    VisitaService.buscarAtiva.mockRejectedValue(new Error("Sessão expirada. Faça login novamente."));
    await refocarTela();

    await waitFor(() => expect(pararHeartbeat).toHaveBeenCalled());
    // Erro não é resposta "sem visita": a visita guardada para o checkout automático
    // continua (o logout por sessão expirada já encerra o geofencing por conta própria).
    expect(sincronizarVisitaAtiva).not.toHaveBeenCalled();
  });
});
