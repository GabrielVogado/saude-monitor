/**
 * Ranking público de hospitais (E4-05 — Sprint S8).
 *
 * Cobre o contrato com `GET /api/v1/hospitais/ranking`: troca de ordenação
 * (NOTA/TEMPO), filtro por tipo, paginação incremental e estado de erro. A
 * ordenação é responsabilidade do backend — a tela apenas repassa os parâmetros
 * e renderiza a posição pela ordem recebida.
 */
import React from "react";
import { render, fireEvent, screen, waitFor } from "@testing-library/react-native";
import RankingScreen from "../../../screens/hospitais/view/RankingScreen";
import HospitalService from "../../../screens/hospitais/service/HospitalService";

jest.mock("../../../screens/hospitais/service/HospitalService");

const HOSPITAL_TOP = {
  id: "h1",
  nome: "Hospital Alfa",
  tipo: "PUBLICO",
  categoria: "HOSPITAL",
  indicadores: { indicadoresDisponiveis: true, notaMedia: 4.8, nAvaliacoes: 12, tempoMedianoMinutos: 30 },
};
const HOSPITAL_SEGUNDO = {
  id: "h2",
  nome: "Hospital Beta",
  tipo: "PRIVADO",
  categoria: "UPA",
  indicadores: { indicadoresDisponiveis: true, notaMedia: 4.1, nAvaliacoes: 9, tempoMedianoMinutos: 20 },
};

const NAVEGACAO = { navigate: jest.fn(), goBack: jest.fn() };

function pagina(content, { page = 0, totalPages = 1 } = {}) {
  return { content, page, size: 20, totalElements: content.length, totalPages };
}

function renderizar() {
  return render(<RankingScreen navigation={NAVEGACAO} />);
}

describe("RankingScreen (E4-05)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    HospitalService.ranking.mockResolvedValue(pagina([HOSPITAL_TOP, HOSPITAL_SEGUNDO]));
  });

  test("carrega o ranking por nota e numera as posições na ordem recebida", async () => {
    renderizar();

    expect(await screen.findByText("Hospital Alfa")).toBeTruthy();
    expect(HospitalService.ranking).toHaveBeenCalledWith({
      ordem: "NOTA",
      tipo: "",
      page: 0,
      size: 20,
    });
    expect(screen.getByText("1º")).toBeTruthy();
    expect(screen.getByText("2º")).toBeTruthy();
  });

  test("alternar para 'Menor tempo' recarrega o ranking com ordem TEMPO", async () => {
    renderizar();
    await screen.findByText("Hospital Alfa");

    fireEvent.press(screen.getByLabelText("Ordenar por menor tempo"));

    await waitFor(() => {
      expect(HospitalService.ranking).toHaveBeenLastCalledWith({
        ordem: "TEMPO",
        tipo: "",
        page: 0,
        size: 20,
      });
    });
  });

  test("filtro por tipo é repassado ao backend", async () => {
    renderizar();
    await screen.findByText("Hospital Alfa");

    // "Público" também aparece como badge no card — o chip tem rótulo próprio.
    fireEvent.press(screen.getByLabelText("Filtrar por público"));

    await waitFor(() => {
      expect(HospitalService.ranking).toHaveBeenLastCalledWith({
        ordem: "NOTA",
        tipo: "PUBLICO",
        page: 0,
        size: 20,
      });
    });
  });

  test("paginação incremental anexa a página seguinte sem descartar a atual", async () => {
    HospitalService.ranking.mockResolvedValueOnce(pagina([HOSPITAL_TOP], { page: 0, totalPages: 2 }));
    HospitalService.ranking.mockResolvedValueOnce(pagina([HOSPITAL_SEGUNDO], { page: 1, totalPages: 2 }));

    renderizar();
    await screen.findByText("Hospital Alfa");

    // Simula a rolagem até o fim da lista pelo próprio FlatList.
    const lista = screen.UNSAFE_getByType(require("react-native").FlatList);
    fireEvent(lista, "onEndReached");

    expect(await screen.findByText("Hospital Beta")).toBeTruthy();
    expect(screen.getByText("Hospital Alfa")).toBeTruthy();
  });

  test("falha na carga exibe empty state com ação de tentar novamente", async () => {
    HospitalService.ranking.mockRejectedValueOnce(new Error("Backend indisponível."));

    renderizar();

    expect(await screen.findByText("Backend indisponível.")).toBeTruthy();

    HospitalService.ranking.mockResolvedValue(pagina([HOSPITAL_TOP]));
    fireEvent.press(screen.getByText("Tentar novamente"));

    expect(await screen.findByText("Hospital Alfa")).toBeTruthy();
  });

  test("tocar em um hospital abre o detalhe", async () => {
    renderizar();
    await screen.findByText("Hospital Alfa");

    fireEvent.press(screen.getByLabelText("Hospital Alfa, Hospital"));

    expect(NAVEGACAO.navigate).toHaveBeenCalledWith("HospitalDetalhe", { id: "h1" });
  });
});
