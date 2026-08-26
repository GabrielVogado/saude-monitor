import * as Location from "expo-location";
import VisitaService from "./VisitaService";

/**
 * Heartbeat periódico da visita ativa (E2-09/RN-23): sinaliza ao backend que o usuário
 * ainda está no hospital, evitando a expiração automática (`VisitaExpiracaoJob`) e
 * renovando o sinal de posição usado para detectar `GPS_INTERROMPIDO` (RN-06).
 *
 * Limitação conhecida (MVP): este serviço usa `setInterval`, que só executa com o app em
 * foreground — heartbeat em background nativo está fora do escopo deste commit. Enquanto
 * o app estiver em background, quem cobre a ausência de sinal é o job do backend
 * (`VisitaGpsInterrompidoJob`, marca `GPS_INTERROMPIDO` após 10min sem sinal) e o próprio
 * geofencing (`GeofencingTaskService`), que confirma o checkout ao detectar a saída.
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
    // Falha de rede não interrompe o ciclo; a próxima tentativa ocorre em 30min e, se o
    // backend não receber nenhum sinal por 10min, a visita é encerrada como GPS_INTERROMPIDO.
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
