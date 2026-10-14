/**
 * Rodapé legal compartilhado pelas telas de login e cadastro.
 */
import React from "react";
import { Linking } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import CSRodapeLegal, { CSAvisoLgpd } from "../../components/CSRodapeLegal";
import { URL_TERMOS_USO } from "../../config/linksLegais";

describe("CSRodapeLegal", () => {
  afterEach(() => jest.restoreAllMocks());

  test("mostra os selos sem prometer anonimato nem criptografia de ponta a ponta", () => {
    render(<CSRodapeLegal onPrivacidade={jest.fn()} />);

    expect(screen.getByText("Conexão criptografada")).toBeTruthy();
    expect(screen.getByText("Estatísticas sem identificar você")).toBeTruthy();
    expect(screen.queryByText(/ponta a ponta/i)).toBeNull();
  });

  test("Termos abre a página publicada", () => {
    jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<CSRodapeLegal onPrivacidade={jest.fn()} />);

    fireEvent.press(screen.getByRole("link", { name: "Termos de Uso" }));

    expect(Linking.openURL).toHaveBeenCalledWith(URL_TERMOS_USO);
  });

  test("Privacidade chama a navegação recebida da tela", () => {
    const onPrivacidade = jest.fn();
    render(<CSRodapeLegal onPrivacidade={onPrivacidade} />);

    fireEvent.press(screen.getByRole("link", { name: "Política de Privacidade" }));

    expect(onPrivacidade).toHaveBeenCalledTimes(1);
  });
});

describe("CSAvisoLgpd", () => {
  test("explica que a estatística não mostra quem respondeu", () => {
    render(<CSAvisoLgpd />);

    expect(screen.getByText(/calculados sem mostrar quem respondeu/)).toBeTruthy();
    expect(screen.queryByText(/anônimas/)).toBeNull();
  });
});
