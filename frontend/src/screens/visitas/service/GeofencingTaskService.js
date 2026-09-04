import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import HospitalService from "../../hospitais/service/HospitalService";
import VisitaService from "./VisitaService";
import { agendarFeedback } from "../../feedback/service/FeedbackNotificationService";
import { centroDoHospital } from "../../../utils/geojson";

/**
 * Geofencing nativo (F-03/ADR-002): substitui o GPS contínuo (que não funciona em
 * background no iOS e drena bateria) por `expo-location.startGeofencingAsync` +
 * `expo-task-manager`, que o SO mantém ativo mesmo com o app fechado.
 *
 * `TaskManager.defineTask` precisa ser chamado no escopo do módulo (fora de qualquer
 * componente), pois o SO reinicia o processo JS em background e reexecuta este arquivo
 * antes de disparar o evento — se a task não estiver registrada aqui, o evento se perde.
 */
export const GEOFENCING_TASK = "VISITAS_GEOFENCING_TASK";

const RAIO_GEOFENCE_METROS = 120;
const RAIO_BUSCA_HOSPITAIS_KM = 5;

// RN-01: só confirma entrada após 2 minutos contínuos dentro do geofence.
const TOLERANCIA_ENTRADA_MS = 2 * 60 * 1000;
// RN-03: só confirma saída após 5 minutos contínuos fora do geofence.
const TOLERANCIA_SAIDA_MS = 5 * 60 * 1000;

// Os eventos nativos de geofencing (Enter/Exit) disparam uma única vez, sem noção de
// "contínuo" — as tolerâncias RN-01/RN-03 são aplicadas aqui, em memória, com
// `setTimeout` por hospital (`region.identifier`), cancelado se o evento oposto chegar
// antes do tempo (ex.: usuário passa em frente ao hospital sem entrar).
const timersEntrada = new Map();
const timersSaida = new Map();

// Id da visita ativa conhecida por este processo, usado para confirmar o checkout
// automático. É reidratado por `buscarAtiva()` sempre que o app volta ao foreground
// (ver `HomeScreen.js`), então não depende de o app continuar vivo em memória.
let visitaAtivaId = null;

// Hospital da visita ativa, para o feedback pós-saída (Épico 03 — E3-01).
let visitaAtivaHospitalId = null;

function limparTimer(mapa, hospitalId) {
  const timer = mapa.get(hospitalId);
  if (timer) {
    clearTimeout(timer);
    mapa.delete(hospitalId);
  }
}

function paraPosicaoGeoJson(region) {
  return {
    type: "Point",
    coordinates: [region.longitude, region.latitude],
  };
}

async function confirmarEntrada(hospitalId, posicao) {
  try {
    const resposta = await VisitaService.checkin({
      hospitalId,
      origem: "GEOFENCE",
      posicao,
    });
    visitaAtivaId = resposta?.id || visitaAtivaId;
    if (resposta?.id) {
      visitaAtivaHospitalId = hospitalId;
    }
  } catch (erro) {
    // Aparelho sem internet: o check-in foi para a fila offline (OPS-05) e sai
    // quando a conexão voltar, com o horário real da entrada. Não é falha.
    if (erro?.enfileirado) {
      return;
    }

    // Conflito de geofences sobrepostos (HTTP 409, E2-04): a tarefa de background não
    // tem UI para perguntar "qual hospital é este?" — o usuário resolve manualmente ao
    // abrir o app e tocar em "Check-in" no card do hospital, na aba Hospitais, que trata
    // o 409 exibindo os candidatos (HospitaisScreen). Este comentário citava a
    // `CheckinManualScreen`, tela que ficou órfã na revisão de navegação e foi removida
    // em 03/09/2026 — o caminho de recuperação descrito aqui apontava para algo que já
    // não era alcançável.
    // Demais erros (rede, hospital inativo) seguem o mesmo caminho: sem retry aqui.
    if (erro?.status !== 409) {
      // eslint-disable-next-line no-console
      console.warn("GeofencingTaskService: falha ao confirmar entrada", erro?.message);
    }
  }
}

// O `hospitalId` chega da região do geofence, mas o checkout usa a visita ativa
// guardada em memória: quem manda é o registro aberto, não a região que disparou.
async function confirmarSaida(_hospitalId) {
  if (!visitaAtivaId) {
    return;
  }

  const encerrarLocalmente = () => {
    // Épico 03 — E3-01: pede o feedback ~1–5 min após a saída automática por geofence.
    agendarFeedback({
      visitaId: visitaAtivaId,
      hospitalId: visitaAtivaHospitalId,
      hospitalNome: null,
      saidaEm: new Date().toISOString(),
    });
    visitaAtivaId = null;
    visitaAtivaHospitalId = null;
  };

  try {
    await VisitaService.checkout(visitaAtivaId, {});
    encerrarLocalmente();
  } catch (erro) {
    // Sem internet, o checkout ficou na fila offline (OPS-05) com o horário real
    // da saída: a entrega está garantida, então o app pode encerrar a visita
    // localmente. Insistir aqui só reenfileiraria o mesmo evento.
    if (erro?.enfileirado) {
      encerrarLocalmente();
      return;
    }

    // eslint-disable-next-line no-console
    console.warn("GeofencingTaskService: falha ao confirmar saída", erro?.message);
  }
}

TaskManager.defineTask(GEOFENCING_TASK, ({ data, error }) => {
  if (error) {
    return;
  }

  const { eventType, region } = data || {};
  const hospitalId = region?.identifier;

  if (!hospitalId) {
    return;
  }

  if (eventType === Location.GeofencingEventType.Enter) {
    limparTimer(timersSaida, hospitalId);

    if (!timersEntrada.has(hospitalId)) {
      const timer = setTimeout(() => {
        timersEntrada.delete(hospitalId);
        confirmarEntrada(hospitalId, paraPosicaoGeoJson(region));
      }, TOLERANCIA_ENTRADA_MS);
      timersEntrada.set(hospitalId, timer);
    }
  } else if (eventType === Location.GeofencingEventType.Exit) {
    limparTimer(timersEntrada, hospitalId);

    if (!timersSaida.has(hospitalId)) {
      const timer = setTimeout(() => {
        timersSaida.delete(hospitalId);
        confirmarSaida(hospitalId);
      }, TOLERANCIA_SAIDA_MS);
      timersSaida.set(hospitalId, timer);
    }
  }
});

/**
 * Monta as regiões circulares (raio ~120m) a partir do centroide do geofence de cada
 * hospital próximo (E2-01/E2-02) e inicia o geofencing nativo. Idempotente: chamadas
 * repetidas reiniciam a lista de regiões monitoradas.
 */
export async function iniciarGeofencing() {
  const permissaoForeground = await Location.requestForegroundPermissionsAsync();
  if (permissaoForeground.status !== "granted") {
    return;
  }

  // Geofencing nativo em background exige a permissão "always" (Android
  // ACCESS_BACKGROUND_LOCATION / iOS NSLocationAlwaysAndWhenInUseUsageDescription).
  const permissaoBackground = await Location.requestBackgroundPermissionsAsync();
  if (permissaoBackground.status !== "granted") {
    return;
  }

  let posicaoAtual;
  try {
    posicaoAtual = await Location.getCurrentPositionAsync({});
  } catch {
    return;
  }

  let hospitais;
  try {
    hospitais = await HospitalService.listar({
      latitude: posicaoAtual.coords.latitude,
      longitude: posicaoAtual.coords.longitude,
      raioKm: RAIO_BUSCA_HOSPITAIS_KM,
      size: 50,
    });
  } catch {
    return;
  }

  const lista = hospitais?.content || hospitais || [];

  const regioes = lista
    .map((hospital) => {
      // E8-03: a listagem devolve `localizacao` (centroide) em vez do poligono.
      const centroide = centroDoHospital(hospital);
      if (!centroide || !hospital.id) {
        return null;
      }

      return {
        identifier: hospital.id,
        latitude: centroide.latitude,
        longitude: centroide.longitude,
        radius: RAIO_GEOFENCE_METROS,
        notifyOnEnter: true,
        notifyOnExit: true,
      };
    })
    .filter(Boolean);

  if (regioes.length === 0) {
    return;
  }

  await Location.startGeofencingAsync(GEOFENCING_TASK, regioes);
}

/** Informa a este serviço qual visita está ativa (para confirmar o checkout automático). */
export function sincronizarVisitaAtiva(visitaId) {
  visitaAtivaId = visitaId || null;
  if (!visitaId) {
    visitaAtivaHospitalId = null;
  }
}

/** Encerra o geofencing nativo e limpa temporizadores pendentes (ex.: logout). */
export async function pararGeofencing() {
  timersEntrada.forEach((timer) => clearTimeout(timer));
  timersSaida.forEach((timer) => clearTimeout(timer));
  timersEntrada.clear();
  timersSaida.clear();
  visitaAtivaId = null;
  visitaAtivaHospitalId = null;

  const tarefaRegistrada = await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK);
  if (tarefaRegistrada) {
    await Location.stopGeofencingAsync(GEOFENCING_TASK);
  }
}
