/**
 * Tela de atualização obrigatória (APP-03).
 */
import React from "react";
import { AppState, Linking, Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import AtualizacaoObrigatoria from "../../../screens/atualizacao/AtualizacaoObrigatoria";
import ConfiguracaoRemota from "../../../services/ConfiguracaoRemota";

jest.mock("../../../services/ConfiguracaoRemota", () => {
  const real = jest.requireActual("../../../services/ConfiguracaoRemota");
  return {
    __esModule: true,
    ...real,
    isAtualizacaoObrigatoria: (config) => real.isAtualizacaoObrigatoria(config, "1.0.0"),
    default: { obterConfiguracao: jest.fn() },
  };
});

function renderizar() {
  return render(
    <AtualizacaoObrigatoria>
      <Text>Conteúdo do app</Text>
    </AtualizacaoObrigatoria>
  );
}

describe("AtualizacaoObrigatoria", () => {
  let ouvinteAppState;

  beforeEach(() => {
    ConfiguracaoRemota.obterConfiguracao.mockReset();
    jest.spyOn(AppState, "addEventListener").mockImplementation((_evento, ouvinte) => {
      ouvinteAppState = ouvinte;
      return { remove: jest.fn() };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("versão aceita segue para o app", async () => {
    ConfiguracaoRemota.obterConfiguracao.mockResolvedValue({ versaoMinimaApp: "1.0.0" });

    renderizar();

    expect(await screen.findByText("Conteúdo do app")).toBeTruthy();
    expect(screen.queryByText("Atualize o Radar Saúde")).toBeNull();
  });

  test("abaixo da mínima mostra a tela de atualização no lugar do app", async () => {
    ConfiguracaoRemota.obterConfiguracao.mockResolvedValue({ versaoMinimaApp: "1.1.0" });

    renderizar();

    expect(await screen.findByText("Atualize o Radar Saúde")).toBeTruthy();
    expect(screen.queryByText("Conteúdo do app")).toBeNull();
  });

  test("o botão abre a página do app na loja", async () => {
    ConfiguracaoRemota.obterConfiguracao.mockResolvedValue({ versaoMinimaApp: "9.0.0" });
    const abrir = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    renderizar();

    fireEvent.press(await screen.findByRole("button", { name: "Atualizar agora" }));

    await act(async () => {});
    expect(abrir).toHaveBeenCalledWith(expect.stringMatching(/^market:\/\/details\?id=/));
  });

  test("sem o app da loja, abre a página web", async () => {
    ConfiguracaoRemota.obterConfiguracao.mockResolvedValue({ versaoMinimaApp: "9.0.0" });
    const abrir = jest
      .spyOn(Linking, "openURL")
      .mockRejectedValueOnce(new Error("sem Play Store"))
      .mockResolvedValue(true);
    renderizar();

    fireEvent.press(await screen.findByRole("button", { name: "Atualizar agora" }));

    await act(async () => {});
    expect(abrir).toHaveBeenLastCalledWith(expect.stringMatching(/^https:\/\/play\.google\.com/));
  });

  test("sem rede o app segue normal", async () => {
    ConfiguracaoRemota.obterConfiguracao.mockRejectedValue(new Error("sem internet"));

    renderizar();
    await act(async () => {});

    expect(screen.getByText("Conteúdo do app")).toBeTruthy();
  });

  test("confere de novo quando o app volta ao primeiro plano", async () => {
    ConfiguracaoRemota.obterConfiguracao.mockResolvedValueOnce({ versaoMinimaApp: null });
    renderizar();
    await screen.findByText("Conteúdo do app");
    ConfiguracaoRemota.obterConfiguracao.mockResolvedValueOnce({ versaoMinimaApp: "2.0.0" });

    await act(async () => {
      ouvinteAppState("background");
      ouvinteAppState("active");
    });

    expect(await screen.findByText("Atualize o Radar Saúde")).toBeTruthy();
    expect(ConfiguracaoRemota.obterConfiguracao).toHaveBeenCalledTimes(2);
  });
});
