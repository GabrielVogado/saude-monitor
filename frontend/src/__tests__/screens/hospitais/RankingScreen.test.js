/**
 * Ranking público de hospitais (E4-05 — Sprint S8).
 *
 * Cobre o contrato com `GET /api/v1/hospitais/ranking`: troca de ordenação
 * (NOTA/TEMPO), filtro por tipo, paginação incremental e estado de erro. A
 * ordenação é responsabilidade do backend — a tela apenas repassa os parâmetros
 * e renderiza a posição pela ordem recebida.
 */
import React from "react";
import { render, fireEvent, screen, waitFor, act } from "@testing-library/react-native";
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

  test("code-review 09/09/2026: trocar o filtro enquanto a próxima página está em voo não mistura os dois critérios", async () => {
    // Mesma corrida corrigida em HospitaisScreen.js: sem um guard de geração, a
    // resposta de uma página pedida sob o filtro ANTIGO chegando depois do filtro
    // NOVO já ter recarregado a lista era concatenada por cima — misturando dois
    // rankings de critérios diferentes.
    const HOSPITAL_ANTIGO = {
      id: "h3",
      nome: "Hospital Gama",
      tipo: "PUBLICO",
      categoria: "HOSPITAL",
      indicadores: { indicadoresDisponiveis: false },
    };
    const HOSPITAL_FILTRADO = {
      id: "h4",
      nome: "Hospital Delta",
      tipo: "PRIVADO",
      categoria: "UPA",
      indicadores: { indicadoresDisponiveis: false },
    };

    let resolverPaginaAntiga;
    let chamadas = 0;
    HospitalService.ranking.mockImplementation(() => {
      chamadas += 1;
      if (chamadas === 1) {
        return Promise.resolve(pagina([HOSPITAL_TOP], { page: 0, totalPages: 2 }));
      }
      if (chamadas === 2) {
        return new Promise((resolve) => {
          resolverPaginaAntiga = resolve;
        });
      }
      return Promise.resolve(pagina([HOSPITAL_FILTRADO], { page: 0, totalPages: 1 }));
    });

    renderizar();
    await screen.findByText("Hospital Alfa");

    const lista = screen.UNSAFE_getByType(require("react-native").FlatList);
    fireEvent(lista, "onEndReached");

    fireEvent.press(screen.getByLabelText("Filtrar por privado"));

    expect(await screen.findByText("Hospital Delta")).toBeTruthy();
    expect(screen.queryByText("Hospital Alfa")).toBeNull();

    // A página antiga (do filtro já substituído) resolve por último — precisa ser
    // descartada, não concatenada sobre o ranking já atualizado.
    await act(async () => {
      resolverPaginaAntiga(pagina([HOSPITAL_ANTIGO], { page: 1, totalPages: 2 }));
    });

    expect(screen.queryByText("Hospital Gama")).toBeNull();
    expect(screen.getByText("Hospital Delta")).toBeTruthy();
  });

  test("code-review 09/09/2026: dois onEndReached em sequência rápida não duplicam a mesma página", async () => {
    let chamadasDePaginaSeguinte = 0;
    HospitalService.ranking.mockImplementation(({ page }) => {
      if (page === 0) {
        return Promise.resolve(pagina([HOSPITAL_TOP], { page: 0, totalPages: 3 }));
      }
      chamadasDePaginaSeguinte += 1;
      return Promise.resolve(pagina([HOSPITAL_SEGUNDO], { page: 1, totalPages: 3 }));
    });

    renderizar();
    await screen.findByText("Hospital Alfa");

    const lista = screen.UNSAFE_getByType(require("react-native").FlatList);
    await act(async () => {
      fireEvent(lista, "onEndReached");
      fireEvent(lista, "onEndReached");
    });

    await screen.findByText("Hospital Beta");
    expect(chamadasDePaginaSeguinte).toBe(1);
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
