import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/query/queryKeys";
import { useSessao } from "../../../core/stores/sessaoStore";
import VisitaService from "../service/VisitaService";

/**
 * Visita ativa fica fresca por 30 s: é o que muda com check-in e checkout, então vale
 * mais atual que o catálogo de hospitais (2 min), sem refazer a consulta a cada troca
 * de aba.
 */
export const STALE_TIME_VISITA_ATIVA_MS = 30 * 1000;

/**
 * Visita ativa do usuário (ou do aparelho, no modo anônimo), compartilhada por todo o
 * app (SDD de TanStack Query e Zustand, §6.5).
 *
 * A chave inclui o usuário: no login e no logout a identidade muda, e a visita do
 * anônimo nunca aparece como do logado (nem o contrário). Espera a sessão ser lida do
 * aparelho (`hidratada`) para não consultar com a identidade errada.
 */
export function useVisitaAtiva() {
  const hidratada = useSessao((estado) => estado.hidratada);
  const usuarioId = useSessao((estado) => estado.usuario?.id ?? null);

  return useQuery({
    queryKey: queryKeys.visitas.ativa(usuarioId),
    queryFn: ({ signal }) => VisitaService.buscarAtiva({ signal }),
    enabled: hidratada,
    staleTime: STALE_TIME_VISITA_ATIVA_MS,
  });
}

