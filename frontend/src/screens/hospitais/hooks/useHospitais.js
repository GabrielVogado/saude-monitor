import { useCallback } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/query/queryKeys";
import { normalizeText } from "../../../utils/normalize";
import HospitalService from "../service/HospitalService";

// O backend limita `size` a 100 por chamada (HospitalController) e a base tem ~340
// hospitais ativos — uma única página nunca traz o catálogo inteiro. 50 é o meio-termo
// entre poucas chamadas e uma resposta que ainda cabe confortavelmente numa página.
export const TAMANHO_PAGINA_LISTA = 50;
export const TAMANHO_PAGINA_RANKING = 20;
// Maior página aceita pelo backend: o mapa precisa do catálogo inteiro.
export const TAMANHO_PAGINA_MAPA = 100;

/** Itens de uma página: o backend devolve `Page`, mas versões antigas devolviam array. */
function itensDaPagina(pagina) {
  return pagina?.content || pagina || [];
}

/** Junta as páginas carregadas numa lista só (`select` do `useInfiniteQuery`). */
function juntarPaginas(dados) {
  return dados.pages.flatMap(itensDaPagina);
}

/** Próxima página enquanto o que já veio não alcança `totalElements`. */
function proximaPaginaPorTotal(tamanho) {
  return (ultimaPagina, _paginas, ultimoParametro) => {
    const lista = itensDaPagina(ultimaPagina);
    const carregado = ultimoParametro * tamanho + lista.length;
    const total = ultimaPagina?.totalElements ?? carregado;
    return lista.length > 0 && carregado < total ? ultimoParametro + 1 : undefined;
  };
}

/**
 * Lista pública de hospitais com paginação incremental (E1-03).
 *
 * Cada combinação de busca e tipo é uma chave própria: uma página que chega depois de
 * o usuário mudar a busca é descartada pela própria biblioteca (e cancelada pelo
 * `signal`), o que dispensa as refs manuais de geração e de reentrância.
 *
 * A busca é normalizada (acento/caixa) antes de ir ao backend e filtrada de novo no
 * cliente: garante consistência mesmo que o backend devolva itens fora do critério
 * (ex.: dados legados sem normalização).
 */
export function useHospitaisLista({ busca, tipo }) {
  const termo = normalizeText(busca);
  // Estável por termo: um `select` novo a cada render recriaria a lista e, com ela, o
  // `renderItem` memoizado da tela.
  const filtrar = useCallback(
    (dados) => {
      const lista = juntarPaginas(dados);
      return termo ? lista.filter((hospital) => normalizeText(hospital?.nome).includes(termo)) : lista;
    },
    [termo]
  );
  return useInfiniteQuery({
    queryKey: queryKeys.hospitais.lista({ busca: termo, tipo }),
    queryFn: ({ pageParam, signal }) =>
      HospitalService.listar({ busca: termo, tipo, page: pageParam, size: TAMANHO_PAGINA_LISTA, signal }),
    initialPageParam: 0,
    getNextPageParam: proximaPaginaPorTotal(TAMANHO_PAGINA_LISTA),
    select: filtrar,
  });
}

/**
 * Ranking público (E4-05). O backend já ordena globalmente; trocar `ordem` ou `tipo`
 * muda a chave e recomeça da primeira página.
 */
export function useRankingHospitais({ ordem, tipo }) {
  return useInfiniteQuery({
    queryKey: queryKeys.hospitais.ranking({ ordem, tipo }),
    queryFn: ({ pageParam, signal }) =>
      HospitalService.ranking({ ordem, tipo, page: pageParam, size: TAMANHO_PAGINA_RANKING, signal }),
    initialPageParam: 0,
    getNextPageParam: (ultimaPagina, _paginas, ultimoParametro) => {
      const atual = ultimaPagina?.page ?? ultimoParametro;
      return atual + 1 < (ultimaPagina?.totalPages ?? 0) ? atual + 1 : undefined;
    },
    select: juntarPaginas,
  });
}

/** Dados públicos do hospital (detalhe e destaque do check-in ativo na lista). */
export function useHospital(id) {
  return useQuery({
    queryKey: queryKeys.hospitais.detalhe(id),
    queryFn: ({ signal }) => HospitalService.buscarPorId(id, { signal }),
    enabled: Boolean(id),
  });
}

/**
 * Indicadores enriquecidos do endpoint dedicado (§3.5 / E4-01..E4-04). Se falharem
 * (ex.: agregado ainda materializando), a tela usa os embutidos no detalhe.
 */
export function useIndicadoresHospital(id) {
  return useQuery({
    queryKey: queryKeys.hospitais.indicadores(id),
    queryFn: ({ signal }) => HospitalService.buscarIndicadores(id, { signal }),
    enabled: Boolean(id),
  });
}

/**
 * Hospitais do mapa (item 05 + F-07).
 *
 * Com `origem` (posição do GPS) e `raioKm`, o recorte geográfico é do backend e cabe
 * numa página. Sem raio, o catálogo inteiro vem em páginas de 100 que o mapa vai
 * buscando em sequência (`fetchNextPage`), atualizando lote a lote em vez de montar
 * centenas de marcadores numa leva só (BUG-04).
 */
export function useHospitaisMapa({ raioKm, origem }) {
  const comRaio = raioKm !== null && Boolean(origem);
  const filtros = comRaio
    ? { raioKm, latitude: origem.latitude, longitude: origem.longitude }
    : { raioKm: null };

  return useInfiniteQuery({
    queryKey: queryKeys.hospitais.mapa(filtros),
    queryFn: ({ pageParam, signal }) =>
      comRaio
        ? HospitalService.listar({ ...filtros, size: TAMANHO_PAGINA_MAPA, signal })
        : HospitalService.listar({ page: pageParam, size: TAMANHO_PAGINA_MAPA, signal }),
    initialPageParam: 0,
    getNextPageParam: comRaio ? () => undefined : proximaPaginaPorTotal(TAMANHO_PAGINA_MAPA),
    select: juntarPaginas,
  });
}
