/**
 * Mutações de visita e feedback (Fase 4 da SDD de TanStack Query e Zustand) e a visita
 * ativa como as telas de Hospitais e do Detalhe a mostram.
 */
import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { criarQueryClientDeTeste } from "../../helpers/renderComProviders";
import { queryKeys } from "../../../core/query/queryKeys";
import { definirUsuarioDaSessao } from "../../../core/stores/sessaoStore";
import { ErroSemInternet } from "../../../config/http";
import VisitaService from "../../../screens/visitas/service/VisitaService";
import FeedbackService from "../../../screens/feedback/service/FeedbackService";
import { useCheckinManual, useCheckoutManual } from "../../../screens/visitas/hooks/useMutacoesVisita";
import { useVisitaAtivaDaTela } from "../../../screens/visitas/hooks/useVisitaAtivaDaTela";
import { useEnviarFeedback } from "../../../screens/feedback/hooks/useEnviarFeedback";

jest.mock("../../../screens/visitas/service/VisitaService");
jest.mock("../../../screens/feedback/service/FeedbackService");

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

function renderizarHook(hook, cliente = criarQueryClientDeTeste()) {
  const wrapper = ({ children }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  return { ...renderHook(hook, { wrapper }), cliente };
}

describe("mutações de visita (Fase 4)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    definirUsuarioDaSessao({ id: "u1", nome: "Ana" });
    VisitaService.buscarAtiva.mockResolvedValue({ visita: null });
  });

  afterEach(() => {
    definirUsuarioDaSessao(null);
  });

  test("check-in grava a visita confirmada só na chave da visita ativa do usuário", async () => {
    const cliente = criarQueryClientDeTeste();
    const historico = { content: [{ id: "antiga" }] };
    cliente.setQueryData([...queryKeys.visitas.all, "outra"], historico);
    VisitaService.checkin.mockResolvedValue({ id: "v1", hospitalId: "h1" });

    const { result } = renderizarHook(() => useCheckinManual(), cliente);
    await act(async () => {
      await result.current.mutateAsync({ hospitalId: "h1" });
    });

    expect(VisitaService.checkin).toHaveBeenCalledWith({ hospitalId: "h1", origem: "MANUAL" });
    expect(cliente.getQueryData(queryKeys.visitas.ativa("u1"))).toEqual({
      visita: { id: "v1", hospitalId: "h1", origem: "MANUAL" },
    });
    expect(cliente.getQueryData([...queryKeys.visitas.all, "outra"])).toBe(historico);
    expect(cliente.getQueryState(queryKeys.visitas.ativa("u1")).isInvalidated).toBe(true);
  });

  test("checkout grava 'sem visita' e repassa o encerramento manual", async () => {
    const cliente = criarQueryClientDeTeste();
    cliente.setQueryData(queryKeys.visitas.ativa("u1"), { visita: { id: "v1" } });
    VisitaService.checkout.mockResolvedValue({ id: "v1", duracaoMinutos: 8 });

    const { result } = renderizarHook(() => useCheckoutManual(), cliente);
    let resposta;
    await act(async () => {
      resposta = await result.current.mutateAsync("v1");
    });

    expect(VisitaService.checkout).toHaveBeenCalledWith("v1", { encerramentoManual: true });
    expect(resposta).toEqual({ id: "v1", duracaoMinutos: 8 });
    expect(cliente.getQueryData(queryKeys.visitas.ativa("u1"))).toEqual({ visita: null });
  });

  test("falha no check-in não mexe na visita ativa", async () => {
    const cliente = criarQueryClientDeTeste();
    VisitaService.checkin.mockRejectedValue(new Error("Backend indisponível."));

    const { result } = renderizarHook(() => useCheckinManual(), cliente);
    await act(async () => {
      await expect(result.current.mutateAsync({ hospitalId: "h1" })).rejects.toThrow("Backend indisponível.");
    });

    expect(cliente.getQueryData(queryKeys.visitas.ativa("u1"))).toBeUndefined();
  });
});

describe("useVisitaAtivaDaTela", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    definirUsuarioDaSessao(null);
  });

  test("a visita local vale até a próxima resposta do servidor", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({ visita: null });
    const { result, cliente } = renderizarHook(() => useVisitaAtivaDaTela());
    await waitFor(() => expect(cliente.getQueryData(queryKeys.visitas.ativa(null))).toEqual({ visita: null }));

    act(() => {
      result.current.definirLocal({ id: null, hospitalId: "h1", origem: "MANUAL" });
    });
    expect(result.current.visita).toEqual({ id: null, hospitalId: "h1", origem: "MANUAL" });

    // Ainda sem conexão: a falha não derruba a visita local.
    VisitaService.buscarAtiva.mockRejectedValue(new ErroSemInternet("http://exemplo"));
    await act(async () => {
      callbackDeFoco();
    });
    expect(result.current.visita).toEqual({ id: null, hospitalId: "h1", origem: "MANUAL" });

    // A fila sincronizou: a resposta do servidor substitui a visita local.
    VisitaService.buscarAtiva.mockResolvedValue({ visita: { id: "v9", hospitalId: "h1", origem: "MANUAL" } });
    await act(async () => {
      callbackDeFoco();
    });
    await waitFor(() => expect(result.current.visita).toEqual({ id: "v9", hospitalId: "h1", origem: "MANUAL" }));
  });

  test("antes de ler a sessão do aparelho, não consulta nem recarrega no foco", async () => {
    const { sessaoStore } = require("../../../core/stores/sessaoStore");
    sessaoStore.setState({ hidratada: false, usuario: null });

    const { result } = renderizarHook(() => useVisitaAtivaDaTela());
    await act(async () => {
      callbackDeFoco();
    });

    expect(VisitaService.buscarAtiva).not.toHaveBeenCalled();
    expect(result.current.visita).toBeNull();
  });
});

describe("useEnviarFeedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("cria com POST, edita com PUT e marca o histórico da conta como desatualizado", async () => {
    const cliente = criarQueryClientDeTeste();
    cliente.setQueryData(queryKeys.conta.historico("u1"), { content: [] });
    FeedbackService.enviar.mockResolvedValue({ id: "fb1" });
    FeedbackService.atualizar.mockResolvedValue({ id: "fb1" });

    const { result } = renderizarHook(() => useEnviarFeedback(), cliente);
    await act(async () => {
      await result.current.mutateAsync({ payload: { visitaId: "v1", nota: 4 } });
    });
    expect(FeedbackService.enviar).toHaveBeenCalledWith({ visitaId: "v1", nota: 4 });
    expect(cliente.getQueryState(queryKeys.conta.historico("u1")).isInvalidated).toBe(true);

    await act(async () => {
      await result.current.mutateAsync({ feedbackId: "fb1", payload: { visitaId: "v1", nota: 5 } });
    });
    expect(FeedbackService.atualizar).toHaveBeenCalledWith("fb1", { visitaId: "v1", nota: 5 });
  });
});
