import { useCallback, useState } from "react";
import { ErroDeConexao } from "../../../config/http";
import { useRecarregarNoFoco } from "../../../core/query/useRecarregarNoFoco";
import { useSessao } from "../../../core/stores/sessaoStore";
import { useVisitaAtiva } from "./useVisitaAtiva";

/**
 * Visita ativa como as telas de Hospitais e do Detalhe a mostram, lida da mesma query
 * do `VisitaAtivaSync` (sem uma consulta própria por tela).
 *
 * Regras que as telas já seguiam:
 * - recarrega ao voltar para a tela (a visita pode ter mudado no geofencing);
 * - sem conexão, mantém a última visita conhecida;
 * - erro real do servidor mostra "sem visita";
 * - um check-in ou checkout guardado na fila offline vale na tela até a próxima resposta
 *   do servidor (`definirLocal`). Janela residual e decisão de aceitá-la documentadas em
 *   `preservarSeSemConexao` (utils/alertas.js).
 *
 * O estado local não vai para o cache: o `VisitaAtivaSync` só deve reagir ao que o
 * servidor confirmou (uma visita sem id pararia o heartbeat e apagaria a visita guardada
 * pelo geofencing).
 */
export function useVisitaAtivaDaTela() {
  const hidratada = useSessao((estado) => estado.hidratada);
  const { data, dataUpdatedAt, error, errorUpdatedAt, refetch } = useVisitaAtiva();
  const [local, setLocal] = useState(null);

  useRecarregarNoFoco(refetch, hidratada);

  const erroReal = Boolean(error) && !(error instanceof ErroDeConexao) && errorUpdatedAt >= dataUpdatedAt;
  const ultimaResposta = erroReal ? errorUpdatedAt : dataUpdatedAt;

  // Guarda qual resposta estava na tela quando o estado local foi definido: qualquer
  // resposta nova do servidor (sucesso ou erro real) o substitui. Falha de conexão não
  // conta como resposta.
  const definirLocal = useCallback(
    (visita) => {
      setLocal({ visita, aposResposta: ultimaResposta });
    },
    [ultimaResposta]
  );

  if (local && local.aposResposta === ultimaResposta) {
    return { visita: local.visita, definirLocal };
  }
  return { visita: erroReal ? null : data?.visita || null, definirLocal };
}
