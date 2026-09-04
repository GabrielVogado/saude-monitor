/**
 * Tela de Login (F0-01) — a porta de entrada do app.
 *
 * Estava em **0% de cobertura**, o pior número do projeto, e foi o exemplo que o PO
 * citou nominalmente. É a tela onde uma regressão silenciosa custa mais caro: se o
 * login quebra, nenhuma outra funcionalidade é alcançável.
 *
 * Os testes cobrem os quatro caminhos que o `handleLogin` de fato tem — campo vazio,
 * credencial inválida, erro sem mensagem e sucesso — mais os dois `navigate` da tela.
 */
import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, screen, waitFor } from "@testing-library/react-native";
import LoginScreen from "../../../screens/auth/view/LoginScreen";
import LoginService from "../../../screens/auth/service/LoginService";

jest.mock("../../../screens/auth/service/LoginService");

const NAVEGACAO = { navigate: jest.fn() };

function renderizar() {
  return render(<LoginScreen navigation={NAVEGACAO} />);
}

/** Preenche os dois campos obrigatórios com credenciais válidas. */
function preencherCredenciais(email = "ana@exemplo.com", senha = "segredo123") {
  fireEvent.changeText(screen.getByPlaceholderText("E-mail ou Nome de Usuario"), email);
  fireEvent.changeText(screen.getByPlaceholderText("••••••••"), senha);
}

function tocarEntrar() {
  fireEvent.press(screen.getByLabelText("Entrar no sistema"));
}

describe("LoginScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  test("campo vazio nem chega a chamar o serviço", async () => {
    renderizar();

    tocarEntrar();

    expect(LoginService.login).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Atencao",
      "Preencha e-mail/usuario e senha."
    );
  });

  test("espaço em branco conta como vazio — o `trim()` do guard", async () => {
    renderizar();
    preencherCredenciais("   ", "   ");

    tocarEntrar();

    expect(LoginService.login).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Atencao",
      "Preencha e-mail/usuario e senha."
    );
  });

  test("login bem-sucedido envia as credenciais e vai para a área logada", async () => {
    LoginService.login.mockResolvedValueOnce({ accessToken: "t" });
    renderizar();
    preencherCredenciais();

    tocarEntrar();

    await waitFor(() => expect(LoginService.login).toHaveBeenCalledTimes(1));
    expect(LoginService.login).toHaveBeenCalledWith({
      email: "ana@exemplo.com",
      password: "segredo123",
      rememberDevice: false,
    });
    // Padrao-UI-UX v2.0 §4.1: o sucesso navega para Perfil, raiz do PerfilStack.
    expect(NAVEGACAO.navigate).toHaveBeenCalledWith("Perfil");
  });

  test("'lembrar este dispositivo' viaja no payload quando marcado", async () => {
    LoginService.login.mockResolvedValueOnce({ accessToken: "t" });
    renderizar();
    preencherCredenciais();

    fireEvent.press(screen.getByLabelText("Lembrar este dispositivo"));
    tocarEntrar();

    await waitFor(() => expect(LoginService.login).toHaveBeenCalledTimes(1));
    expect(LoginService.login).toHaveBeenCalledWith(
      expect.objectContaining({ rememberDevice: true })
    );
  });

  test("credencial inválida mostra a mensagem do serviço e não navega", async () => {
    LoginService.login.mockRejectedValueOnce(new Error("Credenciais inválidas."));
    renderizar();
    preencherCredenciais();

    tocarEntrar();

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Erro no login", "Credenciais inválidas.")
    );
    expect(NAVEGACAO.navigate).not.toHaveBeenCalledWith("Perfil");
  });

  test("erro sem mensagem cai no texto padrão — o ramo `|| 'Erro inesperado.'`", async () => {
    LoginService.login.mockRejectedValueOnce({});
    renderizar();
    preencherCredenciais();

    tocarEntrar();

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Erro no login", "Erro inesperado.")
    );
  });

  test("o botão volta a ficar disponível depois da falha — o `finally` solta o loading", async () => {
    LoginService.login.mockRejectedValueOnce(new Error("Servidor indisponível."));
    renderizar();
    preencherCredenciais();

    tocarEntrar();
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());

    // Se o `finally` não rodasse, o rótulo continuaria "Entrando no sistema" e o
    // usuário ficaria preso numa tela travada após um erro de rede.
    expect(screen.getByLabelText("Entrar no sistema")).toBeTruthy();

    LoginService.login.mockResolvedValueOnce({ accessToken: "t" });
    tocarEntrar();
    await waitFor(() => expect(LoginService.login).toHaveBeenCalledTimes(2));
  });

  test("no Android o teclado encolhe a tela em vez de empurrar o conteúdo", () => {
    // Único ramo de plataforma da tela (`Platform.OS === "ios" ? "padding" : "height"`).
    // O preset do jest-expo já roda como iOS, então este é o lado que a suíte nunca
    // exercitava. Errar aqui esconde o botão Entrar atrás do teclado — e num dos dois
    // sistemas o defeito passa despercebido.
    const { Platform } = require("react-native");
    const original = Platform.OS;
    Platform.OS = "android";
    try {
      renderizar();
      expect(screen.getByLabelText("Entrar no sistema")).toBeTruthy();
    } finally {
      Platform.OS = original;
    }
  });

  test("o link de privacidade navega para a tela correspondente", () => {
    renderizar();

    fireEvent.press(screen.getByLabelText("Política de Privacidade"));

    expect(NAVEGACAO.navigate).toHaveBeenCalledWith("Privacidade");
  });
});
