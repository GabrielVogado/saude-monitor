import { useCallback, useEffect, useMemo } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "../../../core/query/queryClient";
import { queryKeys } from "../../../core/query/queryKeys";
import { normalizeText } from "../../../utils/normalize";
import { haversineMetros } from "../../../utils/distancia";
import { centroDoHospital } from "../../../utils/geojson";
import HospitalService from "../service/HospitalService";
import CatalogoLocal from "../../../services/CatalogoLocal";

export const TAMANHO_PAGINA_RANKING = 20;

const METROS_POR_KM = 1000;

/** Itens de uma página: o backend devolve `Page`, mas versões antigas devolviam array. */
function itensDaPagina(pagina) {
  return pagina?.content || pagina || [];
}

/** Junta as páginas carregadas numa lista só (`select` do `useInfiniteQuery`). */
function juntarPaginas(dados) {
  return dados.pages.flatMap(itensDaPagina);
}

/**
 * Ordem da listagem do backend (nome, depois id), em comparação binária como a do
 * MongoDB: com `localeCompare` a lista trocaria de ordem quando a página do servidor
 * substituísse a cópia (ex.: "UPA" e "Ubs").
 */
function compararComoOBackend(a, b) {
  const chaveA = [String(a?.nome ?? ""), String(a?.id ?? "")];
  const chaveB = [String(b?.nome ?? ""), String(b?.id ?? "")];
  if (chaveA[0] !== chaveB[0]) {
    return chaveA[0] < chaveB[0] ? -1 : 1;
  }
  if (chaveA[1] !== chaveB[1]) {
    return chaveA[1] < chaveB[1] ? -1 : 1;
  }
  return 0;
}

/** Nota e tempo do servidor ficam frescos por 5 minutos, o mesmo atraso do backend (P8). */
export const STALE_TIME_INDICADORES_MS = 5 * 60 * 1000;

/**
 * Lista de hospitais (E1-03), da cópia do catálogo guardada no aparelho (APP-01), com filtro
 * de tipo, busca por nome e a mesma ordem da listagem do servidor. A tela não pagina mais no
 * servidor: o catálogo inteiro (~340 estabelecimentos) já está no aparelho.
 *
 * A consulta nunca vence sozinha (`staleTime: Infinity`): quem avisa que o catálogo mudou é
 * a versão da configuração remota (`atualizarCatalogoSeMudou`), que descarta esta consulta
 * só quando a cópia foi trocada. Com cópia guardada, ela volta na hora; sem cópia (primeiro
 * uso), espera o download; sem cópia e sem rede, a consulta falha e a tela mostra o erro.
 */
export function useHospitaisCatalogoLocal({ busca, tipo }) {
  const cliente = useQueryClient();
  const termo = normalizeText(busca);
  const filtrar = useCallback(
    (lista) =>
      lista
        .filter((hospital) => hospital?.ativo !== false)
        .filter((hospital) => !tipo || hospital?.tipo === tipo)
        .filter((hospital) => !termo || normalizeText(hospital?.nome).includes(termo))
        .sort(compararComoOBackend),
    [termo, tipo]
  );
  const consulta = useQuery({
    queryKey: queryKeys.hospitais.catalogoLocal(),
    queryFn: async () => {
      // Com cópia guardada, a tela não espera a rede (teste de campo da rc.6, 21/10/2026:
      // com o backend frio, a lista demorava). Sem cópia (primeiro uso), espera o download.
      const guardada = await CatalogoLocal.lerCopiaGuardada();
      return guardada ?? CatalogoLocal.obterEstabelecimentos();
    },
    staleTime: Infinity,
    select: filtrar,
  });
  const carregou = consulta.isSuccess;
  useEffect(() => {
    if (!carregou) {
      return undefined;
    }
    // Passado um dia sem a versão da configuração, confere em segundo plano e, se a cópia
    // mudou, relê; antes disso, nem vai à rede. Fica fora da consulta para a releitura não
    // concorrer com a leitura que ainda está terminando.
    let montado = true;
    CatalogoLocal.conferirSeVencida()
      .then((mudou) => {
        if (mudou && montado) {
          void cliente.invalidateQueries({ queryKey: queryKeys.hospitais.catalogoLocal() });
        }
      })
      .catch(() => {});
    return () => {
      montado = false;
    };
  }, [carregou, cliente]);
  return consulta;
}

/**
 * Nota e tempo de todos os hospitais numa resposta só, por id (`{ [hospitalId]: indicadores }`).
 * Só é buscada com a tela aberta e vale por 5 minutos; voltar à aba depois disso busca de novo.
 */
export function useIndicadoresDoCatalogo() {
  return useQuery({
    queryKey: queryKeys.hospitais.indicadoresDoCatalogo(),
    queryFn: ({ signal }) => HospitalService.listarIndicadoresDoCatalogo({ signal }),
    staleTime: STALE_TIME_INDICADORES_MS,
    select: (resposta) => resposta?.porHospital ?? {},
  });
}

/**
 * Hospitais da cópia do catálogo com os indicadores do servidor. Enquanto os indicadores
 * não chegam (ou sem rede), cada hospital fica sem nota, em vez de mostrar uma nota antiga:
 * inclusive a que vinha embutida nas cópias do catálogo gravadas antes da M-061.
 */
export function useListaDeHospitais({ busca, tipo }) {
  const catalogo = useHospitaisCatalogoLocal({ busca, tipo });
  const indicadores = useIndicadoresDoCatalogo();
  const porHospital = indicadores.data;
  const hospitais = useMemo(() => {
    const lista = catalogo.data ?? [];
    return lista.map((hospital) => ({ ...hospital, indicadores: porHospital?.[hospital.id] ?? null }));
  }, [catalogo.data, porHospital]);
  return { catalogo, indicadores, hospitais };
}

/**
 * Baixa o catálogo de novo se a versão informada pela configuração remota é outra, e só
 * então descarta a lista em memória para a tela reler a cópia nova.
 *
 * @returns {Promise<boolean>} `true` quando o catálogo mudou.
 */
export async function atualizarCatalogoSeMudou(versao, cliente = queryClient) {
  const mudou = await CatalogoLocal.sincronizarVersao(versao);
  if (mudou) {
    await cliente.invalidateQueries({ queryKey: queryKeys.hospitais.catalogoLocal() });
  }
  return mudou;
}

/**
 * "Puxar para atualizar" da lista: confere o catálogo com o servidor (304 quando nada
 * mudou) e busca os indicadores de novo. Falhas ficam no `error` de cada consulta.
 */
export async function recarregarListaDeHospitais(cliente = queryClient) {
  await Promise.allSettled([
    CatalogoLocal.obterEstabelecimentos({ idadeMaximaMs: 0 }).then(() =>
      cliente.invalidateQueries({ queryKey: queryKeys.hospitais.catalogoLocal() })
    ),
    cliente.invalidateQueries({ queryKey: queryKeys.hospitais.indicadoresDoCatalogo() }),
  ]);
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
 * Hospitais do mapa (item 05 + F-07), da mesma cópia do catálogo da lista. Com `origem`
 * (posição do GPS) e `raioKm`, o recorte por distância é feito no aparelho, a partir do
 * centro de cada estabelecimento, em vez de uma consulta ao servidor por raio.
 *
 * Os indicadores vêm à parte (`indicadoresPorHospital`), e não dentro de cada hospital:
 * assim a chegada de nota e tempo novos não troca a lista de marcadores, que redesenharia
 * centenas deles e reenquadraria a câmera enquanto a pessoa navega no mapa.
 */
export function useHospitaisMapa({ raioKm, origem }) {
  const catalogo = useHospitaisCatalogoLocal({ busca: "", tipo: "" });
  const indicadoresPorHospital = useIndicadoresDoCatalogo().data ?? null;
  const comRaio = raioKm !== null && Boolean(origem);
  const hospitais = useMemo(() => {
    const lista = catalogo.data ?? [];
    if (!comRaio) {
      return lista;
    }
    const limiteEmMetros = raioKm * METROS_POR_KM;
    return lista.filter((hospital) => {
      const distanciaEmMetros = haversineMetros(origem, centroDoHospital(hospital));
      return distanciaEmMetros !== null && distanciaEmMetros <= limiteEmMetros;
    });
  }, [catalogo.data, comRaio, raioKm, origem]);
  return { catalogo, hospitais, indicadoresPorHospital };
}
