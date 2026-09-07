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

/**
 * Piso do raio da REGIÃO monitorada pelo SO — não é o raio do geofence (BUG-08).
 *
 * A região nativa é apenas o gatilho: ela acorda o processo, e quem decide se houve
 * visita é o `$geoIntersects` do backend contra o polígono real do hospital, com a
 * posição de verdade do aparelho (`confirmarEntrada`). Por isso ela pode — e deve —
 * ser mais generosa que o geofence: o geofencing do Android é notoriamente impreciso
 * abaixo de ~100 m, e uma região menor que isso simplesmente não dispara de forma
 * confiável. Uma UBS de 75 m de raio é monitorada numa região de 100 m; quem estiver
 * entre 75 m e 100 m acorda o app e é recusado pelo servidor, que é o comportamento
 * desejado — errar para o lado de perguntar, nunca para o lado de registrar visita de
 * quem está na rua.
 */
const PISO_RAIO_DISPARO_METROS = 100;

const RAIO_BUSCA_HOSPITAIS_KM = 5;

/**
 * Idade máxima de uma leitura de GPS em cache para ainda valer como "onde a pessoa
 * está". Igual à tolerância de entrada: a leitura foi feita, no pior caso, no momento
 * em que o SO disparou o Enter, e é isso que o backend precisa validar.
 */
const IDADE_MAXIMA_POSICAO_MS = 2 * 60 * 1000;

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

/**
 * Posição real do aparelho, para o backend validar a entrada (BUG-08).
 *
 * Antes daqui saía o CENTRO da região do geofence (`region.latitude/longitude`), que é
 * a coordenada do próprio hospital: o ponto chegava ao servidor sempre dentro do
 * polígono, e o `$geoIntersects` do check-in aprovava por construção. Quem decidia era
 * só o raio da região nativa — uma pessoa a duas ruas do hospital virava paciente.
 *
 * Devolve `null` quando não há leitura utilizável; nesse caso o check-in não é enviado.
 * Perder uma visita legítima é recuperável (o usuário faz check-in manual no card do
 * hospital); registrar visita de quem está em casa contamina o tempo de permanência de
 * forma invisível e irreversível.
 */
async function posicaoAtual() {
  const paraGeoJson = (coords) => ({
    type: "Point",
    coordinates: [coords.longitude, coords.latitude],
  });

  try {
    const { coords } = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return paraGeoJson(coords);
  } catch {
    // GPS indisponível no momento do disparo (túnel, prédio, chip de rádio ocupado).
    // A última leitura conhecida serve se for recente o bastante para descrever o agora.
    try {
      const ultima = await Location.getLastKnownPositionAsync({
        maxAge: IDADE_MAXIMA_POSICAO_MS,
      });
      return ultima ? paraGeoJson(ultima.coords) : null;
    } catch {
      return null;
    }
  }
}

async function confirmarEntrada(hospitalId) {
  const posicao = await posicaoAtual();
  if (!posicao) {
    // eslint-disable-next-line no-console
    console.warn(
      "GeofencingTaskService: entrada ignorada — sem posição do aparelho para validar o geofence"
    );
    return;
  }

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
        confirmarEntrada(hospitalId);
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
 * Raio da região nativa de um hospital: o raio real do seu geofence, nunca abaixo do
 * piso de disparo (BUG-08). Antes era 120 m fixo para todos, o que desprezava o
 * `raioMetros` que a API devolve por estabelecimento desde E8-03 e monitorava uma UBS
 * com a mesma folga de um complexo hospitalar.
 */
function raioDaRegiao(hospital) {
  const raio = Number(hospital?.raioMetros);
  if (!Number.isFinite(raio) || raio <= 0) {
    return PISO_RAIO_DISPARO_METROS;
  }
  return Math.max(raio, PISO_RAIO_DISPARO_METROS);
}

/**
 * Monta as regiões circulares a partir do centroide do geofence de cada hospital
 * próximo (E2-01/E2-02) e inicia o geofencing nativo. Idempotente: chamadas repetidas
 * reiniciam a lista de regiões monitoradas.
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
        radius: raioDaRegiao(hospital),
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
