/**
 * Card de avaliações pendentes na Home (RN-09, pedido do PO em 04/10/2026): o feedback
 * fica disponível para quem não respondeu na hora ou ficou com o celular descarregado.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import FeedbacksPendentesCard, {
  __reiniciarSincronizacao,
  descreverPrazo,
} from "../../../screens/feedback/view/FeedbacksPendentesCard";
import {
  dispensarFeedback,
  listarPendencias,
  sincronizarPendenciasDoServidor,
} from "../../../screens/feedback/service/FeedbackNotificationService";

jest.mock("../../../screens/feedback/service/FeedbackNotificationService", () => ({
  JANELA_MS: 24 * 60 * 60 * 1000,
  listarPendencias: jest.fn(),
  sincronizarPendenciasDoServidor: jest.fn(),
  dispensarFeedback: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (callback) => {
    const React = require("react");
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
}));

const PENDENCIA = {
  visitaId: "v1",
  hospitalNome: "UPA Ceilândia",
  saidaEm: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
};

describe("FeedbacksPendentesCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __reiniciarSincronizacao();
    sincronizarPendenciasDoServidor.mockResolvedValue(undefined);
    dispensarFeedback.mockResolvedValue(undefined);
  });

  test("lista a visita pendente com o hospital e o botão de avaliar", async () => {
    listarPendencias.mockResolvedValue([PENDENCIA]);

    render(<FeedbacksPendentesCard />);

    expect(await screen.findByText("UPA Ceilândia")).toBeOnTheScreen();
    expect(screen.getByText("Avaliação pendente")).toBeOnTheScreen();
  });

  test("tocar em Avaliar abre o formulário da visita", async () => {
    listarPendencias.mockResolvedValue([PENDENCIA]);
    render(<FeedbacksPendentesCard />);

    fireEvent.press(await screen.findByRole("button", { name: "Avaliar UPA Ceilândia" }));

    expect(mockNavigate).toHaveBeenCalledWith("Feedback", {
      screen: "FeedbackForm",
      params: { visitaId: "v1", hospitalNome: "UPA Ceilândia" },
    });
  });

  test("Agora não tira a visita da lista e dispensa a pendência", async () => {
    listarPendencias.mockResolvedValue([PENDENCIA]);
    render(<FeedbacksPendentesCard />);

    fireEvent.press(
      await screen.findByRole("button", { name: "Agora não, dispensar avaliação de UPA Ceilândia" })
    );

    expect(screen.queryByText("UPA Ceilândia")).toBeNull();
    expect(dispensarFeedback).toHaveBeenCalledWith("v1");
  });

  test("mostra a visita que só o servidor conhecia depois de sincronizar", async () => {
    listarPendencias
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...PENDENCIA, visitaId: "v-srv", hospitalNome: "HRAN" }]);

    render(<FeedbacksPendentesCard />);

    expect(await screen.findByText("HRAN")).toBeOnTheScreen();
  });

  test("pendência sem nome de hospital aparece como 'Sua visita'", async () => {
    listarPendencias.mockResolvedValue([{ ...PENDENCIA, hospitalNome: null }]);

    render(<FeedbacksPendentesCard />);

    expect(await screen.findByText("Sua visita")).toBeOnTheScreen();
  });

  test("conta as pendências no título quando há mais de uma", async () => {
    listarPendencias.mockResolvedValue([PENDENCIA, { ...PENDENCIA, visitaId: "v2", hospitalNome: "HRAN" }]);

    render(<FeedbacksPendentesCard />);

    expect(await screen.findByText("2 avaliações pendentes")).toBeOnTheScreen();
  });

  test("sem pendência o card não aparece", async () => {
    listarPendencias.mockResolvedValue([]);

    render(<FeedbacksPendentesCard />);

    await waitFor(() => expect(listarPendencias).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/pendente/)).toBeNull();
  });

  test("voltar à Home logo depois não consulta o servidor de novo", async () => {
    listarPendencias.mockResolvedValue([]);
    const { unmount } = render(<FeedbacksPendentesCard />);
    await waitFor(() => expect(sincronizarPendenciasDoServidor).toHaveBeenCalledTimes(1));
    unmount();

    render(<FeedbacksPendentesCard />);
    await waitFor(() => expect(listarPendencias).toHaveBeenCalledTimes(3));

    expect(sincronizarPendenciasDoServidor).toHaveBeenCalledTimes(1);
  });

  test("falha ao ler as pendências não quebra a tela", async () => {
    listarPendencias.mockRejectedValue(new Error("disco"));

    render(<FeedbacksPendentesCard />);

    await waitFor(() => expect(listarPendencias).toHaveBeenCalled());
    expect(screen.queryByText(/pendente/)).toBeNull();
  });
});

describe("descreverPrazo", () => {
  test("prazo no mesmo dia vira 'hoje às HH:mm'", () => {
    const agora = new Date(2026, 9, 4, 8, 0).getTime();
    const saida = new Date(2026, 9, 3, 9, 5).toISOString();

    expect(descreverPrazo(saida, agora)).toBe("hoje às 09:05");
  });

  test("prazo no dia seguinte vira 'amanhã às HH:mm'", () => {
    const agora = new Date(2026, 9, 4, 8, 0).getTime();
    const saida = new Date(2026, 9, 4, 7, 30).toISOString();

    expect(descreverPrazo(saida, agora)).toBe("amanhã às 07:30");
  });

  test("data inválida não gera prazo", () => {
    expect(descreverPrazo("nao-e-data")).toBeNull();
  });
});
