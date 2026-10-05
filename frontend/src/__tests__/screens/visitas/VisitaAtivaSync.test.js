/**
 * Observador global da visita ativa (Auditoria Técnica v4.0, §4.2.2).
 *
 * Antes, só a Home alimentava o heartbeat (E2-09) e o geofencing, e só no foco da aba
 * Início. Estes testes cobrem o bug (check-in feito em outra aba) e as regras que a
 * Home já seguia: oscilação de conexão não para o heartbeat nem apaga a visita
 * guardada pelo geofencing.
 */
import React from "react";
import { act, waitFor } from "@testing-library/react-native";
import { renderComProviders } from "../../helpers/renderComProviders";
import VisitaAtivaSync from "../../../screens/visitas/hooks/VisitaAtivaSync";
import VisitaService from "../../../screens/visitas/service/VisitaService";
import {
  iniciarGeofencing,
  sincronizarVisitaAtiva,
} from "../../../screens/visitas/service/GeofencingTaskService";
import { iniciarHeartbeat, pararHeartbeat } from "../../../screens/visitas/service/HeartbeatService";
import { ErroSemInternet } from "../../../config/http";
import { invalidarVisitaAtiva } from "../../../core/query/queryClient";
import { definirUsuarioDaSessao, sessaoStore } from "../../../core/stores/sessaoStore";

jest.mock("../../../screens/visitas/service/VisitaService");
jest.mock("../../../screens/visitas/service/GeofencingTaskService");
jest.mock("../../../screens/visitas/service/HeartbeatService");

const VISITA = { id: "v1", entrada: "2026-09-28T10:00:00.000Z", hospitalId: "h1" };

function montar() {
  return renderComProviders(<VisitaAtivaSync />);
}

/** Simula o que o app faz ao voltar ao primeiro plano ou depois de um check-in. */
async function recarregar(queryClient) {
  await act(async () => {
    await invalidarVisitaAtiva(queryClient);
  });
}

describe("VisitaAtivaSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessaoStore.setState({ usuario: null, hidratada: true });
    iniciarGeofencing.mockResolvedValue(undefined);
    sincronizarVisitaAtiva.mockResolvedValue(undefined);
  });

  test("inicia o geofencing nativo uma vez, mesmo sem permissão", async () => {
    iniciarGeofencing.mockRejectedValue(new Error("sem permissão"));
    VisitaService.buscarAtiva.mockResolvedValue({ visita: null });

    montar();

    await waitFor(() => expect(iniciarGeofencing).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(sincronizarVisitaAtiva).toHaveBeenCalledWith(null, null, null));
  });

  test("repassa id, entrada e hospital ao geofencing e liga o heartbeat", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({ visita: VISITA });

    montar();

    await waitFor(() =>
      expect(sincronizarVisitaAtiva).toHaveBeenCalledWith("v1", "2026-09-28T10:00:00.000Z", "h1")
    );
    expect(iniciarHeartbeat).toHaveBeenCalledWith("v1");
  });

  test("check-in manual em outra aba liga o heartbeat sem passar pela aba Início (bug §4.2.2)", async () => {
    VisitaService.buscarAtiva.mockResolvedValueOnce({ visita: null });
    const { queryClient } = montar();
    await waitFor(() => expect(pararHeartbeat).toHaveBeenCalled());
    expect(iniciarHeartbeat).not.toHaveBeenCalled();

    // HospitaisScreen.fazerCheckin → invalidarVisitaAtiva()
    VisitaService.buscarAtiva.mockResolvedValue({ visita: VISITA });
    await recarregar(queryClient);

    await waitFor(() => expect(iniciarHeartbeat).toHaveBeenCalledWith("v1"));
    expect(sincronizarVisitaAtiva).toHaveBeenLastCalledWith("v1", "2026-09-28T10:00:00.000Z", "h1");
  });

  test("checkout manual para o heartbeat da visita encerrada", async () => {
    VisitaService.buscarAtiva.mockResolvedValueOnce({ visita: VISITA });
    const { queryClient } = montar();
    await waitFor(() => expect(iniciarHeartbeat).toHaveBeenCalledWith("v1"));

    VisitaService.buscarAtiva.mockResolvedValue({ visita: null });
    await recarregar(queryClient);

    await waitFor(() => expect(pararHeartbeat).toHaveBeenCalled());
    expect(sincronizarVisitaAtiva).toHaveBeenLastCalledWith(null, null, null);
  });

  test("não sincroniza antes da primeira resposta do servidor (não apaga a visita guardada)", async () => {
    let responder;
    VisitaService.buscarAtiva.mockReturnValue(new Promise((r) => (responder = r)));

    montar();
    await waitFor(() => expect(VisitaService.buscarAtiva).toHaveBeenCalled());

    expect(sincronizarVisitaAtiva).not.toHaveBeenCalled();
    expect(pararHeartbeat).not.toHaveBeenCalled();
    await act(async () => responder({ visita: null }));
    await waitFor(() => expect(sincronizarVisitaAtiva).toHaveBeenCalledWith(null, null, null));
  });

  test("não consulta antes de ler a sessão do aparelho", async () => {
    sessaoStore.setState({ usuario: null, hidratada: false });
    VisitaService.buscarAtiva.mockResolvedValue({ visita: null });

    montar();
    await act(async () => {});
    expect(VisitaService.buscarAtiva).not.toHaveBeenCalled();

    await act(async () => definirUsuarioDaSessao({ id: "u1" }));
    await waitFor(() => expect(VisitaService.buscarAtiva).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(sincronizarVisitaAtiva).toHaveBeenCalledWith(null, null, null));
  });

  test("uma recarga sem internet não para o heartbeat nem mexe no geofencing", async () => {
    VisitaService.buscarAtiva.mockResolvedValueOnce({ visita: VISITA });
    const { queryClient } = montar();
    await waitFor(() => expect(iniciarHeartbeat).toHaveBeenCalledWith("v1"));
    pararHeartbeat.mockClear();
    sincronizarVisitaAtiva.mockClear();

    VisitaService.buscarAtiva.mockRejectedValue(new ErroSemInternet("http://exemplo"));
    await recarregar(queryClient);

    expect(pararHeartbeat).not.toHaveBeenCalled();
    expect(sincronizarVisitaAtiva).not.toHaveBeenCalled();
  });

  test("um erro real para o heartbeat, mas não apaga a visita do geofencing", async () => {
    VisitaService.buscarAtiva.mockResolvedValueOnce({ visita: VISITA });
    const { queryClient } = montar();
    await waitFor(() => expect(iniciarHeartbeat).toHaveBeenCalledWith("v1"));
    sincronizarVisitaAtiva.mockClear();

    VisitaService.buscarAtiva.mockRejectedValue(new Error("Falha na requisição (HTTP 500)."));
    await recarregar(queryClient);

    await waitFor(() => expect(pararHeartbeat).toHaveBeenCalled());
    expect(sincronizarVisitaAtiva).not.toHaveBeenCalled();
  });
});
