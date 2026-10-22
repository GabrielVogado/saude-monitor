/**
 * Consultas de hospitais (Fase 3 da SDD de TanStack Query e Zustand): regras de
 * paginação e o filtro local da busca, isolados das telas.
 */
import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { criarQueryClientDeTeste } from "../../helpers/renderComProviders";
import HospitalService from "../../../screens/hospitais/service/HospitalService";
import CatalogoLocal from "../../../services/CatalogoLocal";
import { queryKeys } from "../../../core/query/queryKeys";
import {
  atualizarCatalogoSeMudou,
  recarregarListaDeHospitais,
  useIndicadoresDoCatalogo,
  useHospitaisMapa,
  useRankingHospitais,
} from "../../../screens/hospitais/hooks/useHospitais";

jest.mock("../../../screens/hospitais/service/HospitalService");
jest.mock("../../../services/CatalogoLocal", () => ({
  __esModule: true,
  default: { lerCopiaGuardada: jest.fn(), obterEstabelecimentos: jest.fn(), sincronizarVersao: jest.fn(), conferirSeVencida: jest.fn() },
}));

function renderizarHook(hook) {
  const cliente = criarQueryClientDeTeste();
  const wrapper = ({ children }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  return renderHook(hook, { wrapper });
}

describe("useHospitais (Fase 3 da SDD)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("indicadores do catálogo chegam como mapa por id do hospital", async () => {
    HospitalService.listarIndicadoresDoCatalogo.mockResolvedValue({
      versao: "v1",
      porHospital: { h1: { notaMedia: 4 } },
    });

    const { result } = renderizarHook(() => useIndicadoresDoCatalogo());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ h1: { notaMedia: 4 } });
  });

  test("resposta de indicadores sem o mapa vira mapa vazio", async () => {
    HospitalService.listarIndicadoresDoCatalogo.mockResolvedValue({});

    const { result } = renderizarHook(() => useIndicadoresDoCatalogo());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({});
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

  test("mapa com raio e posição recorta a cópia do catálogo no aparelho", async () => {
    const PERTO = { id: "h1", nome: "Perto", localizacao: { latitude: -15.7, longitude: -47.8 } };
    const LONGE = { id: "h2", nome: "Longe", localizacao: { latitude: -15.9, longitude: -47.8 } };
    CatalogoLocal.lerCopiaGuardada.mockResolvedValue([PERTO, LONGE]);
    CatalogoLocal.conferirSeVencida.mockResolvedValue(false);
    HospitalService.listarIndicadoresDoCatalogo.mockResolvedValue({ porHospital: { h1: { notaMedia: 4 } } });

    const { result } = renderizarHook(() =>
      useHospitaisMapa({ raioKm: 5, origem: { latitude: -15.7, longitude: -47.8 } })
    );

    await waitFor(() => expect(result.current.indicadoresPorHospital).toEqual({ h1: { notaMedia: 4 } }));
    expect(result.current.hospitais.map((h) => h.id)).toEqual(["h1"]);
    expect(HospitalService.listar).not.toHaveBeenCalled();
  });

});

describe("versão do catálogo (pedido do PO de 22/10/2026)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("catálogo trocado descarta a lista em memória para a tela reler a cópia nova", async () => {
    CatalogoLocal.sincronizarVersao.mockResolvedValue(true);
    const cliente = criarQueryClientDeTeste();
    const invalidar = jest.spyOn(cliente, "invalidateQueries");

    await expect(atualizarCatalogoSeMudou("v2", cliente)).resolves.toBe(true);

    expect(CatalogoLocal.sincronizarVersao).toHaveBeenCalledWith("v2");
    expect(invalidar).toHaveBeenCalledWith({ queryKey: queryKeys.hospitais.catalogoLocal() });
  });

  test("mesma versão não mexe na lista em memória", async () => {
    CatalogoLocal.sincronizarVersao.mockResolvedValue(false);
    const cliente = criarQueryClientDeTeste();
    const invalidar = jest.spyOn(cliente, "invalidateQueries");

    await expect(atualizarCatalogoSeMudou("v1", cliente)).resolves.toBe(false);

    expect(invalidar).not.toHaveBeenCalled();
  });

  test("puxar para atualizar confere o catálogo e recarrega os indicadores", async () => {
    CatalogoLocal.obterEstabelecimentos.mockResolvedValue([]);
    const cliente = criarQueryClientDeTeste();
    const invalidar = jest.spyOn(cliente, "invalidateQueries");

    await recarregarListaDeHospitais(cliente);

    expect(CatalogoLocal.obterEstabelecimentos).toHaveBeenCalledWith({ idadeMaximaMs: 0 });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: queryKeys.hospitais.catalogoLocal() });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: queryKeys.hospitais.indicadoresDoCatalogo() });
  });

  test("puxar para atualizar sem rede não lança e ainda recarrega os indicadores", async () => {
    CatalogoLocal.obterEstabelecimentos.mockRejectedValue(new Error("sem rede"));
    const cliente = criarQueryClientDeTeste();
    const invalidar = jest.spyOn(cliente, "invalidateQueries");

    await expect(recarregarListaDeHospitais(cliente)).resolves.toBeUndefined();

    expect(invalidar).toHaveBeenCalledWith({ queryKey: queryKeys.hospitais.indicadoresDoCatalogo() });
  });
});
