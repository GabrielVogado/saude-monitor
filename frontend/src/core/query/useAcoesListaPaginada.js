import { useCallback, useState } from "react";

/**
 * Ações de uma lista paginada sobre `useInfiniteQuery`: puxar para atualizar e buscar a
 * próxima página ao chegar perto do fim (`onEndReached`).
 *
 * `atualizar` mantém o `refreshing` do `RefreshControl` ligado até a recarga terminar e
 * não devolve a promessa, porque o `onRefresh` espera uma função síncrona: a falha da
 * recarga já fica no `error` da consulta, que a tela mostra.
 * `carregarMais` usa `cancelRefetch: false`: um segundo `onEndReached` antes do próximo
 * render (fling rápido) reaproveita a página em voo em vez de cancelá-la e pedir de
 * novo. A falha de uma página seguinte mantém a lista já visível; rolar até o fim de
 * novo tenta outra vez.
 */
export function useAcoesListaPaginada({ refetch, fetchNextPage, hasNextPage, isFetchingNextPage }) {
  const [atualizando, setAtualizando] = useState(false);

  const atualizar = useCallback(() => {
    setAtualizando(true);
    refetch()
      .finally(() => setAtualizando(false))
      .catch(() => {});
  }, [refetch]);

  const carregarMais = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage({ cancelRefetch: false }).catch(() => {});
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return { atualizando, atualizar, carregarMais };
}
