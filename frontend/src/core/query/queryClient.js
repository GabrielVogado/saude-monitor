import { QueryClient } from "@tanstack/react-query";
import { DOMINIOS_PESSOAIS, queryKeys } from "./queryKeys";

/** Dado considerado fresco por 2 minutos: trocar de aba não refaz a requisição. */
export const STALE_TIME_PADRAO_MS = 2 * 60 * 1000;

/** Query sem nenhuma tela usando fica em memória por 15 minutos. */
export const GC_TIME_PADRAO_MS = 15 * 60 * 1000;

/**
 * Cria o `QueryClient` com os padrões do app (SDD de TanStack Query e Zustand, §6.2).
 *
 * **Sem retry no TanStack Query.** O `apiClient` já repete o que vale repetir:
 * até 3 tentativas com backoff e jitter para falha de transporte e 502/503/504, uma só
 * depois de timeout, nenhuma sem internet (`fetchComRetry`, OPS-05). Somar o retry do
 * Query a isso chegaria a 9 requisições por chamada e, com timeouts de 20 s, a mais de
 * um minuto de espera. Erro 4xx também não muda repetindo.
 */
export function criarQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_PADRAO_MS,
        gcTime: GC_TIME_PADRAO_MS,
        retry: false,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/** Instância única do app. */
export const queryClient = criarQueryClient();

/**
 * Remove do cache tudo o que é dado pessoal. Dados públicos (hospitais, ranking)
 * ficam: não pertencem a ninguém e evitam recarregar o catálogo depois do logout.
 */
export function removerDadosPessoais(cliente = queryClient) {
  for (const queryKey of DOMINIOS_PESSOAIS) {
    cliente.removeQueries({ queryKey });
  }
}

/**
 * Marca a visita ativa como desatualizada e busca de novo quem a observa (o
 * `VisitaAtivaSync` na raiz do app). Chamado depois de check-in e checkout manuais e
 * quando a fila offline envia eventos, para que o heartbeat e o geofencing sigam a
 * visita certa sem depender de a aba Início ganhar foco.
 */
export function invalidarVisitaAtiva(cliente = queryClient) {
  return cliente.invalidateQueries({ queryKey: queryKeys.visitas.all });
}
