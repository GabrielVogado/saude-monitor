/**
 * Tela Perfil → Notificações (E6-05 — opt-in dedicado).
 *
 * Cobre o que a história pede: explicar a finalidade antes de pedir, permitir
 * ativar/desativar depois, encaminhar ao SO quando a permissão já foi decidida e
 * auditar a escolha no backend (art. 8º §5º da LGPD).
 */
import React from "react";
import { AppState, Linking } from "react-native";
import * as Notifications from "expo-notifications";
import { render, fireEvent, screen, waitFor, act } from "@testing-library/react-native";
import NotificacoesScreen from "../../../screens/perfil/view/NotificacoesScreen";
import PerfilService from "../../../screens/perfil/service/PerfilService";

jest.mock("../../../screens/perfil/service/PerfilService");

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback) => {
    const React = require("react");
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
}));

const NAVEGACAO = { goBack: jest.fn() };

describe("NotificacoesScreen (E6-05 — opt-in de notificações)", () => {
  let ouvintesAppState;

  beforeEach(() => {
    jest.clearAllMocks();
    ouvintesAppState = [];

    jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    jest.spyOn(AppState, "addEventListener").mockImplementation((_evento, ouvinte) => {
      ouvintesAppState.push(ouvinte);
      return { remove: jest.fn() };
    });

    Notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    Notifications.requestPermissionsAsync.mockResolvedValue({ granted: true });
    Notifications.setNotificationChannelAsync.mockResolvedValue(undefined);
    PerfilService.atualizarConsentimento.mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function renderizar() {
    render(<NotificacoesScreen navigation={NAVEGACAO} />);
    await screen.findByText("Lembretes de avaliação");
  }

  test("explica a finalidade antes de pedir a permissão", async () => {
    await renderizar();

    expect(screen.getByText(/avaliação é anônima/i)).toBeTruthy();
    expect(screen.getByText(/É opcional/i)).toBeTruthy();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  test("ativa a permissão e audita o consentimento no backend", async () => {
    await renderizar();
    await waitFor(() => expect(screen.getByText("Desativadas")).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Ativar notificações"));
    });

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(PerfilService.atualizarConsentimento).toHaveBeenCalledWith({ notificacoes: true });
    await waitFor(() => expect(screen.getByText("Ativas")).toBeTruthy());
    expect(Linking.openSettings).not.toHaveBeenCalled();
  });

  test("encaminha às configurações do sistema quando o usuário nega", async () => {
    Notifications.requestPermissionsAsync.mockResolvedValue({ granted: false });
    await renderizar();
    await waitFor(() => expect(screen.getByText("Desativadas")).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Ativar notificações"));
    });

    expect(PerfilService.atualizarConsentimento).toHaveBeenCalledWith({ notificacoes: false });
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  });

  test("com permissão concedida, desativar registra a decisão e abre o sistema", async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: true });
    await renderizar();
    await waitFor(() => expect(screen.getByText("Ativas")).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Desativar notificações"));
    });

    expect(PerfilService.atualizarConsentimento).toHaveBeenCalledWith({ notificacoes: false });
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  });

  test("orienta manualmente quando não é possível abrir as configurações", async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: true });
    Linking.openSettings.mockRejectedValue(new Error("indisponível"));
    await renderizar();
    await waitFor(() => expect(screen.getByText("Ativas")).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Desativar notificações"));
    });

    expect(screen.getByText(/configurações do dispositivo/i)).toBeTruthy();
  });

  test("ao voltar do sistema, reflete a permissão e audita apenas a mudança", async () => {
    await renderizar();
    await waitFor(() => expect(screen.getByText("Desativadas")).toBeTruthy());

    // Sem mudança: nada é enviado ao backend.
    await act(async () => {
      await Promise.all(ouvintesAppState.map((ouvinte) => ouvinte("active")));
    });
    expect(PerfilService.atualizarConsentimento).not.toHaveBeenCalled();

    Notifications.getPermissionsAsync.mockResolvedValue({ granted: true });
    await act(async () => {
      await Promise.all(ouvintesAppState.map((ouvinte) => ouvinte("active")));
    });

    await waitFor(() => expect(screen.getByText("Ativas")).toBeTruthy());
    expect(PerfilService.atualizarConsentimento).toHaveBeenCalledWith({ notificacoes: true });
  });
});
