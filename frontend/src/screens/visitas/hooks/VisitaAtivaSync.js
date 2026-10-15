import { useEffect } from "react";
import { ErroDeConexao } from "../../../config/http";
import { iniciarGeofencing, sincronizarVisitaAtiva } from "../service/GeofencingTaskService";
import { iniciarHeartbeat, pararHeartbeat } from "../service/HeartbeatService";
import { useVisitaAtiva } from "./useVisitaAtiva";

/**
 * Observador único da visita ativa, montado na raiz do app (Auditoria Técnica v4.0,
 * §4.2.2; SDD de TanStack Query e Zustand, §6.5).
 *
 * Antes, quem alimentava o heartbeat (E2-09) e o geofencing (`sincronizarVisitaAtiva`)
 * era só a Home, e só quando a aba Início ganhava foco. Quem fazia check-in manual na
 * lista de Hospitais e não voltava ao Início ficava sem heartbeat, e o checkout
 * automático não conhecia a visita. Agora a visita ativa é uma query compartilhada e
 * este componente reage a ela, esteja o usuário em qualquer tela.
 *
 * Só sincroniza com resposta do servidor. O dado ainda indefinido da montagem e a
 * falha de rede não podem apagar a visita que o checkout automático em segundo plano
 * precisa (o estado do geofencing é persistido). Entrada e hospital vão junto para o
 * checkout offline e para o feedback (RN-01/RN-07, E3-01).
 */
export default function VisitaAtivaSync() {
  useEffect(() => {
    // Inicia o geofencing nativo (F-03/ADR-002) uma vez, no ciclo de vida do app.
    iniciarGeofencing().catch(() => {
      // Sem permissão de localização em segundo plano: o check-in manual na lista de
      // Hospitais continua disponível; nada a fazer aqui.
    });
  }, []);

  const { data, dataUpdatedAt, error, errorUpdatedAt } = useVisitaAtiva();
  // `data` só existe depois de uma resposta do servidor. Uma falha posterior mantém o
  // último dado bom: o heartbeat de uma visita real não para por oscilação de conexão.
  const conhecida = data !== undefined;
  const visita = data?.visita || null;
  const visitaId = visita?.id || null;
  const entrada = visita?.entrada || null;
  const hospitalId = visita?.hospitalId || null;

  useEffect(() => {
    if (!conhecida) {
      return;
    }
    sincronizarVisitaAtiva(visitaId, entrada, hospitalId).catch(() => {});
    if (visitaId) {
      iniciarHeartbeat(visitaId);
    } else {
      pararHeartbeat();
    }
    // `dataUpdatedAt` reaplica a cada resposta nova do servidor, como a Home fazia a
    // cada foco: o estado do geofencing pode ter mudado em segundo plano.
  }, [conhecida, visitaId, entrada, hospitalId, dataUpdatedAt]);

  // Erro real do servidor (não falta de conexão) para o heartbeat, como a Home fazia,
  // mas não apaga a visita guardada para o checkout automático: erro não é resposta
  // "sem visita". O logout por sessão expirada já encerra o geofencing por conta própria.
  const erroReal = Boolean(error) && !(error instanceof ErroDeConexao);
  useEffect(() => {
    if (erroReal) {
      pararHeartbeat();
    }
  }, [erroReal, errorUpdatedAt]);

  return null;
}
