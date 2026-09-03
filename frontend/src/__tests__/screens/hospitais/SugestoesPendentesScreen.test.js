/**
 * Fila de moderação de sugestões públicas (E1-06).
 *
 * Este arquivo nasceu de um defeito real encontrado pelo lint (E8-13): a tela
 * importava `MapPinOff` e renderizava `<MapPin />`, o que estourava
 * `ReferenceError: MapPin is not defined` ao desenhar **qualquer** item da
 * lista. A tela estava entre as sete sem teste unitário (ENG-05) — é
 * exatamente por isso que o defeito sobreviveu à esteira.
 *
 * O primeiro teste é a regressão: renderizar um item já basta para reprovar.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import SugestoesPendentesScreen from "../../../screens/hospitais/view/SugestoesPendentesScreen";
import HospitalService from "../../../screens/hospitais/service/HospitalService";

jest.mock("../../../screens/hospitais/service/HospitalService");

const SUGESTAO = {
  id: "s1",
  nome: "UPA Ceilândia",
  status: "PENDENTE",
  endereco: { logradouro: "QNM 17", cidade: "Ceilândia", uf: "DF" },
  observacao: "Atende 24h",
  criadoEm: "2026-09-01T12:00:00Z",
};

const NAVEGACAO = { navigate: jest.fn(), goBack: jest.fn() };

describe("SugestoesPendentesScreen (E1-06)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    HospitalService.listarSugestoes.mockResolvedValue({ content: [SUGESTAO] });
  });

  it("renderiza o cartão da sugestão sem quebrar", async () => {
    render(<SugestoesPendentesScreen navigation={NAVEGACAO} />);

    expect(await screen.findByText("UPA Ceilândia")).toBeTruthy();
    // O endereço é a linha que carregava o ícone indefinido.
    expect(screen.getByText(/QNM 17, Ceilândia — DF/)).toBeTruthy();
  });

  it("pede ao serviço as sugestões pendentes por padrão", async () => {
    render(<SugestoesPendentesScreen navigation={NAVEGACAO} />);

    await waitFor(() =>
      expect(HospitalService.listarSugestoes).toHaveBeenCalledWith({
        status: "PENDENTE",
        size: 50,
      })
    );
  });

  it("mostra o estado vazio quando não há sugestões", async () => {
    HospitalService.listarSugestoes.mockResolvedValue({ content: [] });

    render(<SugestoesPendentesScreen navigation={NAVEGACAO} />);

    expect(await screen.findByText("Nenhuma sugestão")).toBeTruthy();
  });

  it("mostra a mensagem do erro quando a busca falha", async () => {
    HospitalService.listarSugestoes.mockRejectedValue(
      new Error("Sem conexão com a internet.")
    );

    render(<SugestoesPendentesScreen navigation={NAVEGACAO} />);

    expect(await screen.findByText("Algo deu errado")).toBeTruthy();
    expect(screen.getByText("Sem conexão com a internet.")).toBeTruthy();
  });
});
