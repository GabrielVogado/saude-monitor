/**
 * Confirmação obrigatória de e-mail no cadastro (10/09/2026) — ConfirmarEmailScreen.
 *
 * Alcançada com o e-mail já preenchido via `route.params.email`, tanto do sucesso do
 * cadastro (`UserScreen`) quanto do bloqueio de login (`LoginScreen`, EMAIL_NAO_CONFIRMADO).
 */
import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, screen, waitFor } from "@testing-library/react-native";
import ConfirmarEmailScreen from "../../../screens/auth/view/ConfirmarEmailScreen";
import LoginService from "../../../screens/auth/service/LoginService";

jest.mock("../../../screens/auth/service/LoginService");

const NAVEGACAO = { navigate: jest.fn(), replace: jest.fn() };

function renderizar(email = "marina@email.com") {
  return render(<ConfirmarEmailScreen navigation={NAVEGACAO} route={{ params: { email } }} />);
}

describe("ConfirmarEmailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  test("chega com o e-mail já preenchido a partir dos params da rota", () => {
    renderizar("marina@email.com");

    expect(screen.getByPlaceholderText("seu-email@exemplo.com").props.value).toBe("marina@email.com");
  });

  test("código vazio nem chega a chamar o serviço", () => {
    renderizar();

    fireEvent.press(screen.getByLabelText("Confirmar"));

    expect(LoginService.confirmarEmail).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith("Atenção", "Informe seu e-mail e o código recebido.");
  });

  test("confirmação com sucesso chama o serviço e volta ao Login", async () => {
    LoginService.confirmarEmail.mockResolvedValueOnce({ success: true });
    renderizar("marina@email.com");

    fireEvent.changeText(screen.getByPlaceholderText("000000"), "123456");
    fireEvent.press(screen.getByLabelText("Confirmar"));

    await waitFor(() => expect(LoginService.confirmarEmail).toHaveBeenCalledTimes(1));
    expect(LoginService.confirmarEmail).toHaveBeenCalledWith({ email: "marina@email.com", codigo: "123456" });
    expect(NAVEGACAO.replace).toHaveBeenCalledWith("Login");
  });

  test("código inválido/expirado mostra a mensagem do backend e não navega", async () => {
    LoginService.confirmarEmail.mockRejectedValueOnce(new Error("Código inválido ou expirado."));
    renderizar();

    fireEvent.changeText(screen.getByPlaceholderText("000000"), "000000");
    fireEvent.press(screen.getByLabelText("Confirmar"));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Erro", "Código inválido ou expirado.")
    );
    expect(NAVEGACAO.replace).not.toHaveBeenCalled();
  });

  test("'Reenviar código' chama o serviço de reenvio com o e-mail atual", async () => {
    LoginService.reenviarConfirmacaoEmail.mockResolvedValueOnce({ success: true });
    renderizar("marina@email.com");

    fireEvent.press(screen.getByLabelText("Reenviar código"));

    await waitFor(() => expect(LoginService.reenviarConfirmacaoEmail).toHaveBeenCalledWith("marina@email.com"));
    expect(Alert.alert).toHaveBeenCalledWith(
      "Verifique seu e-mail",
      expect.stringContaining("novo código")
    );
  });

  test("'Voltar para o login' navega para Login", () => {
    renderizar();

    fireEvent.press(screen.getByLabelText("Voltar para o login"));

    expect(NAVEGACAO.navigate).toHaveBeenCalledWith("Login");
  });
});
