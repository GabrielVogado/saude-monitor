import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../core/query/queryKeys";
import FeedbackService from "../service/FeedbackService";

/**
 * Envio do feedback pós-saída (E3-02): POST na criação, PUT na edição dentro da janela
 * de 24h (RN-09). Depois de gravar, o histórico da conta fica desatualizado para que a
 * avaliação nova apareça na próxima vez que for aberto. A tela trata os erros (409 de
 * visita já avaliada, 404 de visita indisponível).
 */
export function useEnviarFeedback() {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: ({ feedbackId, payload }) =>
      feedbackId ? FeedbackService.atualizar(feedbackId, payload) : FeedbackService.enviar(payload),
    onSuccess: () => cliente.invalidateQueries({ queryKey: queryKeys.conta.all }),
  });
}
