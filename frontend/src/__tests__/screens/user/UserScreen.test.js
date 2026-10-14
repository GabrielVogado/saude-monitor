/**
 * UserScreen (cadastro) — sem nenhuma cobertura antes deste teste. Foco no achado
 * da auditoria de código morto (08/09/2026): o botão "Voltar" do header não tinha
 * `onPress`, então tocá-lo não fazia nada — o único jeito de sair da tela era gesto/
 * hardware back.
 */
import React from "react";
import { Alert, Linking } from "react-native";
import { render, fireEvent, screen, waitFor } from "@testing-library/react-native";
import UserScreen from "../../../screens/user/view/UserScreen";
import UserService from "../../../screens/user/service/UserService";

jest.mock("../../../screens/user/service/UserService");

function preencherFormulario() {
  fireEvent.changeText(screen.getByPlaceholderText("Seu nome completo"), "Marina Souza");
  fireEvent.changeText(screen.getByPlaceholderText("seu@email.com"), "marina@email.com");
  fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "S3nh@Forte!");
  fireEvent.press(screen.getByLabelText("Aceito os Termos de Uso e a Política de Privacidade"));
}

describe("UserScreen (cadastro)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  test("botão Voltar aciona navigation.goBack", () => {
    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    render(<UserScreen navigation={navigation} />);

    fireEvent.press(screen.getByLabelText("Voltar"));

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  test("não quebra quando navigation não fornece goBack", () => {
    render(<UserScreen navigation={{}} />);

    expect(() => fireEvent.press(screen.getByLabelText("Voltar"))).not.toThrow();
  });

  test("cadastro com sucesso leva à confirmação de e-mail (10/09/2026)", async () => {
    // Confirmação obrigatória de e-mail: sem isto, o login é recusado no próximo
    // acesso e o usuário não tem pista nenhuma do porquê.
    UserService.registro.mockResolvedValueOnce({ success: true });
    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    render(<UserScreen navigation={navigation} />);
    preencherFormulario();

    fireEvent.press(screen.getByLabelText("Criar conta"));

    await waitFor(() => expect(UserService.registro).toHaveBeenCalledTimes(1));
    expect(navigation.navigate).toHaveBeenCalledWith("ConfirmarEmail", { email: "marina@email.com" });
  });

  test("falha no cadastro não navega para a confirmação de e-mail", async () => {
    UserService.registro.mockRejectedValueOnce(new Error("Email já cadastrado."));
    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    render(<UserScreen navigation={navigation} />);
    preencherFormulario();

    fireEvent.press(screen.getByLabelText("Criar conta"));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Falha no cadastro", "Email já cadastrado.")
    );
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  test("o link Termos de Uso do aceite abre os Termos publicados", () => {
    jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<UserScreen navigation={{ navigate: jest.fn() }} />);

    fireEvent.press(screen.getByText("Termos de Uso"));

    expect(Linking.openURL).toHaveBeenCalledWith("https://saudemonitor.dev/termos");
  });

  test("o link Política de Privacidade do aceite abre a política publicada", () => {
    jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<UserScreen navigation={{ navigate: jest.fn() }} />);

    fireEvent.press(screen.getByText("Política de Privacidade"));

    expect(Linking.openURL).toHaveBeenCalledWith("https://saudemonitor.dev/privacidade");
  });

  test("o rodapé Termos abre os Termos publicados", () => {
    jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<UserScreen navigation={{ navigate: jest.fn() }} />);

    fireEvent.press(screen.getByLabelText("Termos de Uso"));

    expect(Linking.openURL).toHaveBeenCalledWith("https://saudemonitor.dev/termos");
  });

  test("o rodapé Privacidade abre a tela de privacidade do app", () => {
    const navigation = { navigate: jest.fn() };
    render(<UserScreen navigation={navigation} />);

    fireEvent.press(screen.getByLabelText("Política de Privacidade"));

    expect(navigation.navigate).toHaveBeenCalledWith("Privacidade");
  });

  test("o cadastro registra a versão vigente dos termos aceitos", async () => {
    UserService.registro.mockResolvedValueOnce({ success: true });
    render(<UserScreen navigation={{ goBack: jest.fn(), navigate: jest.fn() }} />);
    preencherFormulario();

    fireEvent.press(screen.getByLabelText("Criar conta"));

    await waitFor(() => expect(UserService.registro).toHaveBeenCalledTimes(1));
    expect(UserService.registro.mock.calls[0][0].consentimento).toEqual({ termosUso: true, versaoTermos: "1.0" });
  });
});
