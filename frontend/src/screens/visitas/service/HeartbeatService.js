import * as Location from "expo-location";
import VisitaService from "./VisitaService";

/**
 * Heartbeat periódico da visita ativa (E2-09/RN-23): sinaliza ao backend que o usuário
 * ainda está no hospital, evitando a expiração automática (`VisitaExpiracaoJob`) e
 * renovando o sinal de posição usado para detectar `GPS_INTERROMPIDO` (RN-06).
 *
 * Este serviço usa `setInterval`, que só executa com o app em primeiro plano. Com o app
 * fechado, o sinal sai da tarefa de acompanhamento do `GeofencingTaskService`, que manda
 * o heartbeat com posição a cada ~10 min enquanto houver visita aberta (exige a permissão
 * "o tempo todo"). Sem nenhum sinal por 45 min, o `VisitaGpsInterrompidoJob` do backend
 * encerra a visita como `GPS_INTERROMPIDO` (RN-06).
 */
const INTERVALO_HEARTBEAT_MS = 30 * 60 * 1000; // RN-23: heartbeat a cada 30 minutos

let intervalId = null;
let visitaIdAtual = null;

async function enviarHeartbeat() {
  if (!visitaIdAtual) {
    return;
  }

  let posicao;
  try {
    const atual = await Location.getCurrentPositionAsync({});
    posicao = {
      type: "Point",
      coordinates: [atual.coords.longitude, atual.coords.latitude],
    };
  } catch {
    // Sem GPS disponível no momento: envia o heartbeat sem posição — ainda sinaliza que
    // a visita está viva, mas não renova `ultimaPosicaoEm` (RN-06 no backend).
    posicao = undefined;
  }

  try {
    await VisitaService.heartbeat(visitaIdAtual, posicao);
  } catch {
    // Falha de rede não interrompe o ciclo; a próxima tentativa ocorre em 30 min. Com o
    // app em segundo plano, quem manda o sinal é o `GeofencingTaskService`.
  }
}

/** Inicia (ou atualiza) o heartbeat periódico enquanto houver uma visita ativa. */
export function iniciarHeartbeat(visitaId) {
  visitaIdAtual = visitaId || null;

  if (!visitaIdAtual || intervalId) {
    return;
  }

  intervalId = setInterval(enviarHeartbeat, INTERVALO_HEARTBEAT_MS);
}

/** Encerra o heartbeat periódico (ex.: checkout ou logout). */
export function pararHeartbeat() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  visitaIdAtual = null;
}
