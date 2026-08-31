/**
 * Tela Histórico (E5-03/RN-22 — histórico do usuário logado).
 *
 * Verifica: (a) área logada — sem sessão mostra o empty state com CTA de login;
 * (b) carrega e lista as visitas do usuário com o nome do hospital anexado pelo
 * backend (hospitalNome); (c) alterna para a aba de avaliações e lista os feedbacks.
 */
import React from "react";
import { render, fireEvent, screen } from "@testing-library/react-native";
import HistoricoScreen from "../../../screens/perfil/view/HistoricoScreen";
import PerfilService from "../../../screens/perfil/service/PerfilService";
import VisitaService from "../../../screens/visitas/service/VisitaService";
import FeedbackService from "../../../screens/feedback/service/FeedbackService";

jest.mock("../../../screens/perfil/service/PerfilService");
jest.mock("../../../screens/visitas/service/VisitaService");
jest.mock("../../../screens/feedback/service/FeedbackService");

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback) => {
    const React = require("react");
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
}));

const NAVEGACAO = { goBack: jest.fn(), navigate: jest.fn() };

function renderizar() {
  return render(<HistoricoScreen navigation={NAVEGACAO} />);
}

describe("HistoricoScreen (E5-03/RN-22)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("sem sessão orienta o login (área logada)", async () => {
    PerfilService.usuarioLogado.mockResolvedValue(null);

    renderizar();
    expect(await screen.findByText("Área logada")).toBeTruthy();
    expect(screen.getByText(/Faça login para ver seu histórico/i)).toBeTruthy();

    fireEvent.press(screen.getByText("Fazer login"));
    expect(NAVEGACAO.navigate).toHaveBeenCalledWith("Login");
  });

  test("lista as visitas do usuário com o nome do hospital", async () => {
    PerfilService.usuarioLogado.mockResolvedValue({ id: "u1", nome: "Marina" });
    VisitaService.listarHistorico.mockResolvedValue({
      content: [
        {
          id: "v1",
          hospitalId: "h1",
          hospitalNome: "Hospital Central",
          entrada: "2026-08-30T10:00:00Z",
          saida: "2026-08-30T11:30:00Z",
          duracaoMinutos: 90,
          status: "FINALIZADA",
          origem: "GEOFENCE",
        },
      ],
    });
    FeedbackService.listarHistorico.mockResolvedValue({ content: [] });

    renderizar();
    expect(await screen.findByText("Hospital Central")).toBeTruthy();
    expect(screen.getByText("Finalizada")).toBeTruthy();
    expect(screen.getByText(/1h30 de permanência/)).toBeTruthy();
    expect(screen.getByText("Automática")).toBeTruthy();
  });

  test("alterna para a aba de avaliações e lista os feedbacks", async () => {
    PerfilService.usuarioLogado.mockResolvedValue({ id: "u1", nome: "Marina" });
    VisitaService.listarHistorico.mockResolvedValue({ content: [] });
    FeedbackService.listarHistorico.mockResolvedValue({
      content: [
        {
          id: "fb1",
          criadoEm: "2026-08-30T12:00:00Z",
          nota: 4,
          comentario: "Atendimento rápido e acolhedor.",
        },
      ],
    });

    renderizar();
    fireEvent.press(await screen.findByText("Avaliações"));
    expect(await screen.findByText("Atendimento rápido e acolhedor.")).toBeTruthy();
    expect(screen.getByText("4,0 / 5")).toBeTruthy();
  });
});
