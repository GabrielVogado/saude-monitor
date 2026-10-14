/**
 * Perfil → Privacidade e Termos (E5-02). Resumo dentro do app com os pontos que a Play
 * Store e a LGPD cobram (controlador, contato, dado sensível de saúde) e links para os
 * textos completos publicados.
 */
import React from "react";
import { Linking } from "react-native";
import { render, fireEvent, screen } from "@testing-library/react-native";
import PrivacidadeScreen from "../../../screens/perfil/view/PrivacidadeScreen";

describe("PrivacidadeScreen", () => {
  beforeEach(() => {
    jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  test("identifica o controlador e o e-mail de contato do titular", () => {
    render(<PrivacidadeScreen navigation={{ goBack: jest.fn() }} />);

    expect(screen.getByText(/controlador\) é Gabriel Vogado/)).toBeTruthy();
    expect(screen.getByText(/privacidade@saudemonitor\.dev/)).toBeTruthy();
  });

  test("trata localização em hospital como dado sensível com consentimento (art. 11)", () => {
    render(<PrivacidadeScreen navigation={{ goBack: jest.fn() }} />);

    expect(screen.getByText(/consentimento específico \(art\. 11, I\)/)).toBeTruthy();
  });

  test("abre a política completa publicada", () => {
    render(<PrivacidadeScreen navigation={{ goBack: jest.fn() }} />);

    fireEvent.press(screen.getByLabelText("Ler a Política de Privacidade completa"));

    expect(Linking.openURL).toHaveBeenCalledWith("https://saudemonitor.dev/privacidade");
  });

  test("abre os Termos de Uso publicados", () => {
    render(<PrivacidadeScreen navigation={{ goBack: jest.fn() }} />);

    fireEvent.press(screen.getByLabelText("Ler os Termos de Uso"));

    expect(Linking.openURL).toHaveBeenCalledWith("https://saudemonitor.dev/termos");
  });

  test("Voltar usa goBack e, sem ele, volta ao Perfil", () => {
    const navigation = { navigate: jest.fn() };
    render(<PrivacidadeScreen navigation={navigation} />);

    fireEvent.press(screen.getByLabelText("Voltar"));

    expect(navigation.navigate).toHaveBeenCalledWith("Perfil");
  });
});
