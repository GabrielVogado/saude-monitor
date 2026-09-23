/**
 * UserScreen (cadastro) — sem nenhuma cobertura antes deste teste. Foco no achado
 * da auditoria de código morto (08/09/2026): o botão "Voltar" do header não tinha
 * `onPress`, então tocá-lo não fazia nada — o único jeito de sair da tela era gesto/
 * hardware back.
 */
import React from "react";
import { Alert } from "react-native";
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
});
