/**
 * Padrões do QueryClient e fábrica de chaves (SDD de TanStack Query e Zustand, §6.2/§6.3).
 */
import {
  GC_TIME_PADRAO_MS,
  STALE_TIME_PADRAO_MS,
  criarQueryClient,
  queryClient,
  removerDadosPessoais,
} from "../../core/query/queryClient";
import { DOMINIOS_PESSOAIS, queryKeys } from "../../core/query/queryKeys";

describe("queryClient", () => {
  test("não repete no TanStack Query: o apiClient já faz o retry com backoff", () => {
    const padroes = criarQueryClient().getDefaultOptions();

    expect(padroes.queries).toMatchObject({
      retry: false,
      staleTime: STALE_TIME_PADRAO_MS,
      gcTime: GC_TIME_PADRAO_MS,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    });
    expect(padroes.mutations.retry).toBe(false);
  });

  test("a instância do app usa os mesmos padrões", () => {
    expect(queryClient.getDefaultOptions().queries.retry).toBe(false);
  });

  test("removerDadosPessoais apaga visitas e conta e preserva os hospitais", () => {
    const cliente = criarQueryClient();
    cliente.setQueryData(queryKeys.hospitais.detalhe("h1"), { id: "h1" });
    cliente.setQueryData(queryKeys.visitas.ativa("u1"), { visita: { id: "v1" } });
    cliente.setQueryData(queryKeys.conta.historico("u1"), { visitas: [] });

    removerDadosPessoais(cliente);

    expect(cliente.getQueryData(queryKeys.hospitais.detalhe("h1"))).toEqual({ id: "h1" });
    expect(cliente.getQueryData(queryKeys.visitas.ativa("u1"))).toBeUndefined();
    expect(cliente.getQueryData(queryKeys.conta.historico("u1"))).toBeUndefined();
  });

  test("removerDadosPessoais sem argumento atua na instância do app", () => {
    queryClient.setQueryData(queryKeys.conta.historico("u1"), { visitas: [] });
    removerDadosPessoais();
    expect(queryClient.getQueryData(queryKeys.conta.historico("u1"))).toBeUndefined();
  });
});

describe("queryKeys", () => {
  test("todas as chaves começam pelo domínio, para invalidar o domínio inteiro", () => {
    expect(queryKeys.hospitais.lista({ busca: "x" })).toEqual(["hospitais", "lista", { busca: "x" }]);
    expect(queryKeys.hospitais.detalhe("h1")).toEqual(["hospitais", "detalhe", "h1"]);
    expect(queryKeys.hospitais.ranking({ ordem: "NOTA" })).toEqual(["hospitais", "ranking", { ordem: "NOTA" }]);
    expect(queryKeys.conta.historico("u1")).toEqual(["conta", "u1", "historico"]);
  });

  test("visita ativa sem identidade cai no anônimo", () => {
    expect(queryKeys.visitas.ativa()).toEqual(["visitas", "ativa", "anonimo"]);
    expect(queryKeys.visitas.ativa("u1")).toEqual(["visitas", "ativa", "u1"]);
  });

  test("os domínios pessoais são visitas e conta", () => {
    expect(DOMINIOS_PESSOAIS).toEqual([["visitas"], ["conta"]]);
  });
});
