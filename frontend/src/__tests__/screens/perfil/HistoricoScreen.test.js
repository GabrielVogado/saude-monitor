/**
 * Tela Histórico (E5-03/RN-22 — histórico do usuário logado).
 *
 * Verifica: (a) área logada — sem sessão mostra o empty state com CTA de login;
 * (b) carrega e lista as visitas do usuário com o nome do hospital anexado pelo
 * backend (hospitalNome); (c) alterna para a aba de avaliações e lista os feedbacks;
 * (d) exporta o relatório de dados pessoais em PDF (art. 18 da LGPD).
 */
import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderComProviders } from "../../helpers/renderComProviders";
import { definirUsuarioDaSessao, sessaoStore } from "../../../core/stores/sessaoStore";
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
  return renderComProviders(<HistoricoScreen navigation={NAVEGACAO} />);
}

describe("HistoricoScreen (E5-03/RN-22)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    definirUsuarioDaSessao(null);
  });

  test("encerrar a sessão com a tela aberta troca a lista pela orientação de login", async () => {
    definirUsuarioDaSessao({ id: "u1", nome: "Marina" });
    VisitaService.listarHistorico.mockResolvedValue({ content: [] });
    FeedbackService.listarHistorico.mockResolvedValue({ content: [] });

    const { queryClient } = renderizar();
    expect(await screen.findByText("Nenhuma visita ainda")).toBeTruthy();
    expect(queryClient.getQueryData(["conta", "u1", "historico"])).toEqual({ visitas: [], feedbacks: [] });

    const { act } = require("@testing-library/react-native");
    act(() => definirUsuarioDaSessao(null));

    expect(await screen.findByText("Área logada")).toBeTruthy();
  });

  test("antes de ler o usuário gravado, não pisca o convite ao login nem consulta a API", async () => {
    sessaoStore.setState({ usuario: null, hidratada: false });

    renderizar();

    expect(screen.queryByText("Área logada")).toBeNull();
    expect(VisitaService.listarHistorico).not.toHaveBeenCalled();

    const { act } = require("@testing-library/react-native");
    act(() => definirUsuarioDaSessao(null));
    expect(await screen.findByText("Área logada")).toBeTruthy();
    expect(VisitaService.listarHistorico).not.toHaveBeenCalled();
  });

  test("falha sem mensagem mostra o texto padrão", async () => {
    definirUsuarioDaSessao({ id: "u1", nome: "Marina" });
    VisitaService.listarHistorico.mockRejectedValue(new Error(""));
    FeedbackService.listarHistorico.mockResolvedValue({ content: [] });

    renderizar();
    expect(await screen.findByText("Não foi possível carregar seu histórico.")).toBeTruthy();
  });

  test("falha ao carregar mostra o erro e tenta de novo pelo botão", async () => {
    definirUsuarioDaSessao({ id: "u1", nome: "Marina" });
    VisitaService.listarHistorico
      .mockRejectedValueOnce(new Error("Servidor fora do ar"))
      .mockResolvedValue({ content: [] });
    FeedbackService.listarHistorico.mockResolvedValue({ content: [] });

    renderizar();
    expect(await screen.findByText("Servidor fora do ar")).toBeTruthy();

    fireEvent.press(screen.getByText("Tentar novamente"));
    expect(await screen.findByText("Nenhuma visita ainda")).toBeTruthy();
    expect(VisitaService.listarHistorico).toHaveBeenCalledTimes(2);
  });

  test("sem sessão orienta o login (área logada)", async () => {
    definirUsuarioDaSessao(null);

    renderizar();
    expect(await screen.findByText("Área logada")).toBeTruthy();
    expect(screen.getByText(/Faça login para ver seu histórico/i)).toBeTruthy();

    fireEvent.press(screen.getByText("Fazer login"));
    expect(NAVEGACAO.navigate).toHaveBeenCalledWith("Login");
  });

  test("lista as visitas do usuário com o nome do hospital", async () => {
    definirUsuarioDaSessao({ id: "u1", nome: "Marina" });
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
    definirUsuarioDaSessao({ id: "u1", nome: "Marina" });
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

  describe("exportação de dados em PDF (E5-03 / art. 18 LGPD)", () => {
    beforeEach(() => {
      definirUsuarioDaSessao({ id: "u1", nome: "Marina" });
      VisitaService.listarHistorico.mockResolvedValue({ content: [] });
      FeedbackService.listarHistorico.mockResolvedValue({ content: [] });
    });

    test("gera o relatório e confirma ao usuário", async () => {
      PerfilService.exportarDadosPdf.mockResolvedValue({
        uri: "file:///cache/meus-dados-2026-09-01.pdf",
        nomeArquivo: "meus-dados-2026-09-01.pdf",
        compartilhado: true,
      });

      renderizar();
      fireEvent.press(await screen.findByLabelText("Exportar meus dados em PDF"));

      expect(PerfilService.exportarDadosPdf).toHaveBeenCalledTimes(1);
      expect(
        await screen.findByText("Relatório meus-dados-2026-09-01.pdf gerado.")
      ).toBeTruthy();
    });

    test("informa onde o arquivo ficou salvo quando não há compartilhamento", async () => {
      PerfilService.exportarDadosPdf.mockResolvedValue({
        uri: "file:///cache/meus-dados-2026-09-01.pdf",
        nomeArquivo: "meus-dados-2026-09-01.pdf",
        compartilhado: false,
      });

      renderizar();
      fireEvent.press(await screen.findByLabelText("Exportar meus dados em PDF"));

      expect(
        await screen.findByText(/salvo como meus-dados-2026-09-01\.pdf/i)
      ).toBeTruthy();
    });

    test("mostra a mensagem de erro quando a exportação falha", async () => {
      PerfilService.exportarDadosPdf.mockRejectedValue(
        new Error("Sessão expirada. Faça login novamente.")
      );

      renderizar();
      fireEvent.press(await screen.findByLabelText("Exportar meus dados em PDF"));

      expect(
        await screen.findByText("Sessão expirada. Faça login novamente.")
      ).toBeTruthy();
    });

    test("bloqueia toques repetidos enquanto o PDF é gerado", async () => {
      let liberar;
      PerfilService.exportarDadosPdf.mockReturnValue(
        new Promise((resolve) => {
          liberar = () => resolve({ nomeArquivo: "meus-dados.pdf", compartilhado: true });
        })
      );

      renderizar();
      const botao = await screen.findByLabelText("Exportar meus dados em PDF");
      fireEvent.press(botao);
      fireEvent.press(botao);

      expect(PerfilService.exportarDadosPdf).toHaveBeenCalledTimes(1);

      liberar();
      await waitFor(() => expect(screen.getByText(/Relatório meus-dados\.pdf/)).toBeTruthy());
    });
  });
});
