/**
 * Tela Perfil → Dados e Privacidade (E5-01, E5-04, E5-05).
 *
 * Foco na revogação nativa do consentimento (E5-05): a decisão é auditada no
 * backend, o usuário é levado às configurações do sistema operacional e o app
 * reconhece a mudança quando volta do SO (`AppState`).
 */
import React from "react";
import { Alert, AppState, Linking } from "react-native";
import { render, fireEvent, screen, waitFor, act } from "@testing-library/react-native";
import PerfilScreen from "../../../screens/perfil/view/PerfilScreen";
import PerfilService from "../../../screens/perfil/service/PerfilService";

jest.mock("../../../screens/perfil/service/PerfilService");
jest.mock("../../../screens/auth/service/LoginService");

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback) => {
    const React = require("react");
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
}));

const NAVEGACAO = { navigate: jest.fn() };

/** Dispara o botão destrutivo do `Alert.alert` de confirmação. */
function confirmarNoAlerta(rotulo) {
  const botoes = Alert.alert.mock.calls.at(-1)[2];
  return botoes.find((b) => b.text === rotulo).onPress();
}

describe("PerfilScreen (E5-05 — revogação nativa)", () => {
  let ouvintesAppState;

  beforeEach(() => {
    jest.clearAllMocks();
    ouvintesAppState = [];

    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    jest.spyOn(AppState, "addEventListener").mockImplementation((_evento, ouvinte) => {
      ouvintesAppState.push(ouvinte);
      return { remove: jest.fn() };
    });

    PerfilService.usuarioLogado.mockResolvedValue({ nome: "Marina", email: "marina@email.com" });
    PerfilService.permissaoLocalizacao.mockResolvedValue("granted");
    PerfilService.atualizarConsentimento.mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function renderizar() {
    render(<PerfilScreen navigation={NAVEGACAO} />);
    // Espera pelo card "Minha conta", e não pelo cabeçalho: o cabeçalho é
    // "Perfil e Privacidade" (o `Text` de `styles.headerTitle`), fica FORA do
    // `ScrollView` e é pintado durante o carregamento — esperar por ele deixaria o
    // teste seguir antes de o perfil chegar. Dentro do `ScrollView`, o carregamento
    // inicial pinta apenas <CSLoadingList count={2} />.
    //
    // (O comentário anterior dizia que o cabeçalho era "Dados e Privacidade". Errado
    // duas vezes: esse texto é um título de card, renderizado só depois do
    // carregamento — logo, esperar por ele seria seguro —, e não é o cabeçalho.)
    await screen.findByText("Minha conta");
  }

  test("revoga: audita no backend e abre as configurações do sistema", async () => {
    await renderizar();

    fireEvent.press(screen.getByLabelText("Revogar permissão de localização"));
    await act(async () => {
      await confirmarNoAlerta("Revogar");
    });

    expect(PerfilService.atualizarConsentimento).toHaveBeenCalledWith({ localizacao: false });
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  });

  test("orienta manualmente quando não é possível abrir as configurações", async () => {
    Linking.openSettings.mockRejectedValue(new Error("indisponível"));
    await renderizar();

    fireEvent.press(screen.getByLabelText("Revogar permissão de localização"));
    await act(async () => {
      await confirmarNoAlerta("Revogar");
    });

    expect(Alert.alert).toHaveBeenLastCalledWith(
      "Revogar no sistema",
      expect.stringContaining("configurações de privacidade do dispositivo")
    );
  });

  test("ao voltar do sistema, reflete a permissão desativada e registra a decisão", async () => {
    await renderizar();
    expect(screen.getByText("Ativa")).toBeTruthy();

    PerfilService.permissaoLocalizacao.mockResolvedValue("denied");
    await act(async () => {
      await Promise.all(ouvintesAppState.map((ouvinte) => ouvinte("active")));
    });

    await waitFor(() => expect(screen.getByText("Desativada")).toBeTruthy());
    expect(PerfilService.atualizarConsentimento).toHaveBeenCalledWith({ localizacao: false });
  });

  test("não registra nada quando a permissão não mudou", async () => {
    await renderizar();

    await act(async () => {
      await Promise.all(ouvintesAppState.map((ouvinte) => ouvinte("active")));
    });

    expect(PerfilService.atualizarConsentimento).not.toHaveBeenCalled();
  });

  test("conceder a permissão também é auditado", async () => {
    PerfilService.permissaoLocalizacao.mockResolvedValue("denied");
    PerfilService.solicitarPermissaoLocalizacao.mockResolvedValue("granted");
    await renderizar();

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Permitir localização"));
    });

    expect(PerfilService.atualizarConsentimento).toHaveBeenCalledWith({ localizacao: true });
  });
});
