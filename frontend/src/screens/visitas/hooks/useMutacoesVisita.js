import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidarVisitaAtiva } from "../../../core/query/queryClient";
import { queryKeys } from "../../../core/query/queryKeys";
import { useSessao } from "../../../core/stores/sessaoStore";
import VisitaService from "../service/VisitaService";
import { posicaoParaCheckinManual } from "../service/PosicaoAparelho";

/**
 * Grava a visita que o servidor acabou de confirmar só na chave da visita ativa deste
 * usuário (nunca em `visitas.all`, que guardaria `{ visita }` em qualquer outra query
 * do domínio) e pede a confirmação ao servidor. O `VisitaAtivaSync` reage na hora:
 * liga ou desliga o heartbeat e avisa o geofencing.
 */
function useConfirmarVisitaAtiva() {
  const cliente = useQueryClient();
  const usuarioId = useSessao((estado) => estado.usuario?.id ?? null);

  return (visita) => {
    cliente.setQueryData(queryKeys.visitas.ativa(usuarioId), { visita });
    void invalidarVisitaAtiva(cliente);
  };
}

/**
 * Check-in manual pelo card de Hospitais (E2-06). A tela trata os erros: o 409 de
 * geofences empatadas (E2-04) e o check-in guardado na fila offline (OPS-05).
 *
 * Leva a posição do aparelho quando a permissão já existe: sem ela a visita é aceita,
 * mas não entra no indicador público (SEG-01).
 */
export function useCheckinManual() {
  const confirmar = useConfirmarVisitaAtiva();

  return useMutation({
    mutationFn: async ({ hospitalId }) =>
      VisitaService.checkin({ hospitalId, origem: "MANUAL", posicao: await posicaoParaCheckinManual() }),
    onSuccess: (resposta) => confirmar({ ...resposta, origem: "MANUAL" }),
  });
}

/** Checkout manual ("Não estou aqui") no detalhe do hospital (E2-02). */
export function useCheckoutManual() {
  const confirmar = useConfirmarVisitaAtiva();

  return useMutation({
    mutationFn: (visitaId) => VisitaService.checkout(visitaId, { encerramentoManual: true }),
    onSuccess: () => confirmar(null),
  });
}
