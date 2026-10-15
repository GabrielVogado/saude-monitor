/**
 * Consultas de hospitais (Fase 3 da SDD de TanStack Query e Zustand): regras de
 * paginação e o filtro local da busca, isolados das telas.
 */
import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { criarQueryClientDeTeste } from "../../helpers/renderComProviders";
import HospitalService from "../../../screens/hospitais/service/HospitalService";
import {
  TAMANHO_PAGINA_LISTA,
  useHospitaisLista,
  useHospitaisMapa,
  useRankingHospitais,
} from "../../../screens/hospitais/hooks/useHospitais";

jest.mock("../../../screens/hospitais/service/HospitalService");

function renderizarHook(hook) {
  const cliente = criarQueryClientDeTeste();
  const wrapper = ({ children }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  return renderHook(hook, { wrapper });
}

describe("useHospitais (Fase 3 da SDD)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("lista aceita a resposta antiga em array e não pede próxima página", async () => {
    HospitalService.listar.mockResolvedValue([{ id: "h1", nome: "Hospital A" }]);

    const { result } = renderizarHook(() => useHospitaisLista({ busca: "", tipo: "" }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "h1", nome: "Hospital A" }]);
    expect(result.current.hasNextPage).toBe(false);
  });

  test("lista pede a próxima página até alcançar o total e para numa página vazia", async () => {
    const cheia = Array.from({ length: TAMANHO_PAGINA_LISTA }, (_, i) => ({ id: `a${i}`, nome: `A ${i}` }));
    HospitalService.listar.mockImplementation(({ page }) =>
      Promise.resolve({ content: page === 0 ? cheia : [], totalElements: 120 })
    );

    const { result } = renderizarHook(() => useHospitaisLista({ busca: "", tipo: "PUBLICO" }));
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(HospitalService.listar).toHaveBeenLastCalledWith(
      expect.objectContaining({ tipo: "PUBLICO", page: 1, size: TAMANHO_PAGINA_LISTA })
    );
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });

  test("ranking para quando a página atual é a última", async () => {
    HospitalService.ranking.mockResolvedValue({ content: [{ id: "h1" }], page: 0, totalPages: 1 });

    const { result } = renderizarHook(() => useRankingHospitais({ ordem: "NOTA", tipo: "" }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "h1" }]);
    expect(result.current.hasNextPage).toBe(false);
  });

  test("ranking sem metadados de página não pede outra", async () => {
    HospitalService.ranking.mockResolvedValue({ content: [{ id: "h1" }] });

    const { result } = renderizarHook(() => useRankingHospitais({ ordem: "TEMPO", tipo: "" }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  test("mapa com raio e posição faz uma consulta só, recortada pelo backend", async () => {
    HospitalService.listar.mockResolvedValue({ content: [{ id: "h1" }], totalElements: 500 });

    const { result } = renderizarHook(() =>
      useHospitaisMapa({ raioKm: 5, origem: { latitude: -15.7, longitude: -47.8 } })
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(HospitalService.listar).toHaveBeenCalledWith(
      expect.objectContaining({ raioKm: 5, latitude: -15.7, longitude: -47.8, size: 100 })
    );
    expect(result.current.hasNextPage).toBe(false);
  });
});
