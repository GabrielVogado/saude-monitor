/**
 * UserScreen (cadastro) — sem nenhuma cobertura antes deste teste. Foco no achado
 * da auditoria de código morto (08/09/2026): o botão "Voltar" do header não tinha
 * `onPress`, então tocá-lo não fazia nada — o único jeito de sair da tela era gesto/
 * hardware back.
 */
import React from "react";
import { render, fireEvent, screen } from "@testing-library/react-native";
import UserScreen from "../../../screens/user/view/UserScreen";
import UserService from "../../../screens/user/service/UserService";

jest.mock("../../../screens/user/service/UserService");

describe("UserScreen (cadastro)", () => {
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
});
