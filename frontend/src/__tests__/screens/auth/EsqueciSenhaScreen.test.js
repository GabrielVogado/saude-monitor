/**
 * "Esqueci minha senha" (E8-05/BUG-03) — EsqueciSenhaScreen.
 *
 * Duas etapas na mesma tela: pedir o código por e-mail, depois confirmar o código e a
 * nova senha. O backend sempre devolve uma resposta genérica em `esqueciSenha` (não
 * revela se o e-mail existe) — a tela nunca tenta diferenciar os dois casos.
 */
import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, screen, waitFor } from "@testing-library/react-native";
import EsqueciSenhaScreen from "../../../screens/auth/view/EsqueciSenhaScreen";
import LoginService from "../../../screens/auth/service/LoginService";

jest.mock("../../../screens/auth/service/LoginService");

const NAVEGACAO = { navigate: jest.fn(), replace: jest.fn() };

function renderizar() {
  return render(<EsqueciSenhaScreen navigation={NAVEGACAO} />);
}

function preencherEmail(email = "marina@email.com") {
  fireEvent.changeText(screen.getByPlaceholderText("seu-email@exemplo.com"), email);
}

async function avancarParaEtapaCodigo(email = "marina@email.com") {
  LoginService.esqueciSenha.mockResolvedValueOnce({ success: true });
  preencherEmail(email);
  fireEvent.press(screen.getByLabelText("Enviar código"));
  await waitFor(() => expect(LoginService.esqueciSenha).toHaveBeenCalledTimes(1));
}

describe("EsqueciSenhaScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  // ------------------------------------------------ Etapa e-mail -----------------------

  test("e-mail vazio nem chega a chamar o serviço", () => {
    renderizar();

    fireEvent.press(screen.getByLabelText("Enviar código"));

    expect(LoginService.esqueciSenha).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith("Atenção", "Informe seu e-mail.");
  });

  test("envia o código, avança para a etapa de código e avisa o usuário", async () => {
    renderizar();

    await avancarParaEtapaCodigo("marina@email.com");

    expect(LoginService.esqueciSenha).toHaveBeenCalledWith("marina@email.com");
    expect(Alert.alert).toHaveBeenCalledWith(
      "Verifique seu e-mail",
      expect.stringContaining("código de 6 dígitos")
    );
    // etapa de código: os campos de código/senha aparecem
    expect(screen.getByPlaceholderText("000000")).toBeTruthy();
  });

  test("falha ao solicitar o código mostra a mensagem do backend e não avança de etapa", async () => {
    LoginService.esqueciSenha.mockRejectedValueOnce(new Error("Servidor indisponível."));
    renderizar();
    preencherEmail();

    fireEvent.press(screen.getByLabelText("Enviar código"));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Erro", "Servidor indisponível.")
    );
    // continua na etapa e-mail: o campo de código não existe
    expect(screen.queryByPlaceholderText("000000")).toBeNull();
  });

  // ------------------------------------------------ Etapa código -----------------------

  test("campos vazios na etapa código nem chegam a chamar o serviço", async () => {
    renderizar();
    await avancarParaEtapaCodigo();

    fireEvent.press(screen.getByLabelText("Redefinir senha"));

    expect(LoginService.redefinirSenha).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith("Atenção", "Preencha o código e a nova senha.");
  });

  test("senhas diferentes barram antes de chamar o serviço", async () => {
    renderizar();
    await avancarParaEtapaCodigo();

    fireEvent.changeText(screen.getByPlaceholderText("000000"), "123456");
    fireEvent.changeText(screen.getByPlaceholderText("Nova senha"), "SenhaA123");
    fireEvent.changeText(screen.getByPlaceholderText("Confirmar nova senha"), "SenhaB456");

    fireEvent.press(screen.getByLabelText("Redefinir senha"));

    expect(LoginService.redefinirSenha).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith("Atenção", "As senhas não coincidem.");
  });

  test("redefinição com sucesso chama o serviço com os dados certos e volta ao Login", async () => {
    LoginService.redefinirSenha.mockResolvedValueOnce({ success: true });
    renderizar();
    await avancarParaEtapaCodigo("marina@email.com");

    fireEvent.changeText(screen.getByPlaceholderText("000000"), "123456");
    fireEvent.changeText(screen.getByPlaceholderText("Nova senha"), "N0vaSenha!");
    fireEvent.changeText(screen.getByPlaceholderText("Confirmar nova senha"), "N0vaSenha!");
    fireEvent.press(screen.getByLabelText("Redefinir senha"));

    await waitFor(() => expect(LoginService.redefinirSenha).toHaveBeenCalledTimes(1));
    expect(LoginService.redefinirSenha).toHaveBeenCalledWith({
      email: "marina@email.com",
      codigo: "123456",
      novaSenha: "N0vaSenha!",
    });
    expect(NAVEGACAO.replace).toHaveBeenCalledWith("Login");
  });

  test("código inválido/expirado mostra a mensagem do backend e não navega", async () => {
    LoginService.redefinirSenha.mockRejectedValueOnce(new Error("Código inválido ou expirado."));
    renderizar();
    await avancarParaEtapaCodigo();

    fireEvent.changeText(screen.getByPlaceholderText("000000"), "000000");
    fireEvent.changeText(screen.getByPlaceholderText("Nova senha"), "N0vaSenha!");
    fireEvent.changeText(screen.getByPlaceholderText("Confirmar nova senha"), "N0vaSenha!");
    fireEvent.press(screen.getByLabelText("Redefinir senha"));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Erro", "Código inválido ou expirado.")
    );
    expect(NAVEGACAO.replace).not.toHaveBeenCalled();
  });

  test("'Reenviar código' volta para a etapa e-mail com o e-mail já preenchido", async () => {
    renderizar();
    await avancarParaEtapaCodigo("marina@email.com");

    fireEvent.press(screen.getByLabelText("Reenviar código"));

    // de volta na etapa e-mail: o campo de e-mail existe e mantém o valor digitado
    expect(screen.getByPlaceholderText("seu-email@exemplo.com").props.value).toBe("marina@email.com");
    expect(screen.queryByPlaceholderText("000000")).toBeNull();
  });

  test("'Voltar para o login' navega para Login", () => {
    renderizar();

    fireEvent.press(screen.getByLabelText("Voltar para o login"));

    expect(NAVEGACAO.navigate).toHaveBeenCalledWith("Login");
  });
});
