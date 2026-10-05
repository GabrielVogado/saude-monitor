import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import HospitalService from "../../hospitais/service/HospitalService";
import VisitaService from "./VisitaService";
import { invalidarVisitaAtiva } from "../../../core/query/queryClient";
import { agendarFeedback } from "../../feedback/service/FeedbackNotificationService";
import { centroDoHospital } from "../../../utils/geojson";
import { duracaoMinutosDesde } from "../../../utils/format";
import { haversineMetros } from "../../../utils/distancia";

/**
 * Geofencing nativo (F-03/ADR-002): substitui o GPS contínuo (que não funciona em
 * background no iOS e drena bateria) por `expo-location.startGeofencingAsync` +
 * `expo-task-manager`, que o SO mantém ativo mesmo com o app fechado.
 *
 * `TaskManager.defineTask` precisa ser chamado no escopo do módulo (fora de qualquer
 * componente), pois o SO reinicia o processo JS em background e reexecuta este arquivo
 * antes de disparar o evento — se a task não estiver registrada aqui, o evento se perde.
 * Por isso o `index.js` importa este módulo antes de registrar o componente raiz.
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

// RN-01: só confirma entrada após 2 minutos contínuos dentro do geofence.
const TOLERANCIA_ENTRADA_MS = 2 * 60 * 1000;
// RN-03: só confirma saída após 5 minutos contínuos fora do geofence.
const TOLERANCIA_SAIDA_MS = 5 * 60 * 1000;

/**
 * Idade máxima de uma leitura de GPS em cache para ainda valer como "onde a pessoa
 * está". Igual à tolerância de entrada: a leitura foi feita, no pior caso, no momento
 * em que o SO disparou o Enter, e é isso que o backend precisa validar.
 */
const IDADE_MAXIMA_POSICAO_MS = TOLERANCIA_ENTRADA_MS;

/**
 * Prazo para uma leitura de GPS "ao vivo" responder. `getCurrentPositionAsync` não tem
 * opção de timeout própria e, em rádio ocupado ou GPS indisponível, a promise pode nunca
 * resolver nem rejeitar — travando a confirmação de entrada indefinidamente em vez de
 * cair no fallback de posição em cache.
 */
const TIMEOUT_LEITURA_GPS_MS = 10 * 1000;

function comTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Tarefa que mantém o processo acordado enquanto há uma entrada ou saída esperando a
 * tolerância (bug de campo de 03/10/2026, Hospital Regional de Ceilândia).
 *
 * O SO acorda o app no Enter/Exit da região, mas não espera 2 ou 5 minutos: o iOS
 * suspende o processo ~10 s depois, e o Android congela ou mata o processo em segundo
 * plano. Um `setTimeout` de 2 minutos armado nesse intervalo só disparava quando o
 * usuário abria o app — exatamente o que o PO viu em campo. Durante a tolerância o app
 * liga atualizações de localização em segundo plano (no Android, com a notificação
 * fixa do serviço em primeiro plano, que é o que o SO exige para não matar o processo)
 * e as desliga assim que não há mais nada pendente. Fora dessas janelas o GPS fica
 * desligado: quem vigia é o geofencing nativo, de baixo consumo.
 */
export const ACOMPANHAMENTO_TASK = "VISITAS_ACOMPANHAMENTO_TASK";

/** Identificador da região que segue o usuário para recalcular os hospitais monitorados. */
export const REGIAO_RECALCULO = "__recalcular_regioes__";

/**
 * Teto de regiões monitoradas: o iOS aceita no máximo 20 por app (o Android, 100). Ficam
 * os 19 hospitais mais próximos mais a região de recálculo, que ao ser deixada para trás
 * refaz a lista a partir da nova posição — sem isso, quem saísse de casa e cruzasse a
 * cidade continuaria monitorando os hospitais do bairro de origem.
 */
const MAX_REGIOES_HOSPITAIS = 19;
// Sem a lista de hospitais (sem internet no recálculo em segundo plano), a região de
// recálculo fica pequena para tentar de novo logo no próximo deslocamento.
const RAIO_RECALCULO_SEM_LISTA_METROS = 500;
const RAIO_RECALCULO_MAX_METROS = 2500;

/**
 * Entrada vencida sem posição do aparelho (GPS sem sinal dentro do prédio) volta para a
 * fila e é tentada de novo a cada leitura, por no máximo este tempo desde o Enter.
 */
const LIMITE_NOVA_TENTATIVA_ENTRADA_MS = 30 * 60 * 1000;
const INTERVALO_NOVA_TENTATIVA_MS = 60 * 1000;

/** Chave do estado do geofencing que precisa sobreviver ao processo ser encerrado. */
const CHAVE_ESTADO = "@saude_monitor:geofencing";

/** Quando o usuário dispensa a explicação da permissão, não insistimos antes disto. */
const CHAVE_EXPLICACAO_DISPENSADA = "@saude_monitor:geofencing:explicacaoDispensadaEm";
const INTERVALO_NOVA_EXPLICACAO_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Estado persistido. Antes ficava só em variáveis do módulo e em `setTimeout`, que somem
 * quando o SO encerra o processo: a saída chegava num processo novo, sem visita ativa
 * em memória, e o checkout automático não acontecia.
 *
 * - `visita`: `{ id, hospitalId, entrada }` da visita ativa conhecida;
 * - `entradas` / `saidas`: `{ [hospitalId]: instante do evento em ms }` aguardando a
 *   tolerância da RN-01 (2 min) ou da RN-03 (5 min).
 */
function estadoVazio() {
  return { visita: null, entradas: {}, saidas: {} };
}

async function lerEstado() {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE_ESTADO);
    if (!bruto) {
      return estadoVazio();
    }
    const lido = JSON.parse(bruto);
    return {
      visita: lido?.visita?.id ? lido.visita : null,
      entradas: lido?.entradas && typeof lido.entradas === "object" ? lido.entradas : {},
      saidas: lido?.saidas && typeof lido.saidas === "object" ? lido.saidas : {},
    };
  } catch {
    return estadoVazio();
  }
}

async function gravarEstado(estado) {
  await AsyncStorage.setItem(CHAVE_ESTADO, JSON.stringify(estado));
}

// Eventos do SO, timers e a tarefa de localização podem chegar ao mesmo tempo; cada
// leitura-modificação-escrita do estado roda em série para um não apagar o outro.
let filaEstado = Promise.resolve();

function emSerie(trabalho) {
  const execucao = filaEstado.then(trabalho);
  filaEstado = execucao.catch(() => {});
  return execucao;
}

function alterarEstado(alteracao) {
  return emSerie(async () => {
    const estado = await lerEstado();
    const antes = JSON.stringify(estado);
    const resultado = await alteracao(estado);
    if (JSON.stringify(estado) !== antes) {
      await gravarEstado(estado);
    }
    return resultado;
  });
}

// Incrementada pelo `pararGeofencing` (logout): trabalho assíncrono iniciado antes dele
// (um check-in esperando o GPS, um recálculo de regiões) não pode, ao terminar,
// regravar a visita nem religar o monitoramento de quem acabou de sair da conta.
let geracao = 0;

// Timers continuam existindo como gatilho extra enquanto o processo está vivo (com o
// acompanhamento ligado, ele fica); a fonte da verdade é o instante salvo no estado.
const timers = new Set();

function agendarAvaliacao(ms) {
  const timer = setTimeout(() => {
    timers.delete(timer);
    processarPendencias().catch(() => {});
  }, ms);
  timers.add(timer);
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
    const { coords } = await comTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      TIMEOUT_LEITURA_GPS_MS
    );
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

/**
 * Envia o check-in automático. Devolve `true` quando vale tentar de novo (sem posição
 * do aparelho no momento): a pessoa continua dentro da região e não haverá outro Enter.
 */
async function confirmarEntrada(hospitalId) {
  const minhaGeracao = geracao;
  const posicao = await posicaoAtual();
  if (!posicao) {
    // eslint-disable-next-line no-console
    console.warn(
      "GeofencingTaskService: entrada adiada — sem posição do aparelho para validar o geofence"
    );
    return true;
  }

  try {
    const resposta = await VisitaService.checkin({
      hospitalId,
      origem: "GEOFENCE",
      posicao,
    });
    if (resposta?.id && minhaGeracao === geracao) {
      await alterarEstado((estado) => {
        estado.visita = {
          id: resposta.id,
          hospitalId,
          entrada: resposta?.entrada || new Date().toISOString(),
        };
      });
    }
    // Com o app aberto em qualquer aba, o observador da visita ativa (VisitaAtivaSync)
    // liga o heartbeat da visita nova; em segundo plano não há quem observe e nada muda.
    void invalidarVisitaAtiva();
  } catch (erro) {
    // Aparelho sem internet: o check-in foi para a fila offline (OPS-05) e sai
    // quando a conexão voltar, com o horário real da entrada. Não é falha.
    if (erro?.enfileirado) {
      return false;
    }

    // Conflito de geofences sobrepostos (HTTP 409, E2-04): a tarefa de background não
    // tem UI para perguntar "qual hospital é este?" — o usuário resolve manualmente ao
    // abrir o app e tocar em "Check-in" no card do hospital, na aba Hospitais, que trata
    // o 409 exibindo os candidatos (HospitaisScreen).
    // Demais erros (rede, hospital inativo) seguem o mesmo caminho: sem retry aqui.
    if (erro?.status !== 409) {
      // eslint-disable-next-line no-console
      console.warn("GeofencingTaskService: falha ao confirmar entrada", erro?.message);
    }
  }
  return false;
}

// O checkout usa a visita ativa guardada no estado: quem manda é o registro aberto. A
// região só confere que a saída é do hospital dessa visita — uma saída antiga de A,
// vencendo depois de um check-in em B, não pode encerrar a visita de B.
async function confirmarSaida(hospitalId) {
  const { visita } = await lerEstado();
  if (!visita || (visita.hospitalId && visita.hospitalId !== hospitalId)) {
    return;
  }

  const encerrarLocalmente = async (duracaoMinutos) => {
    // Épico 03 — E3-01: pede o feedback após a saída automática por geofence, só se a
    // visita passou do piso de 2 min (RN-01/RN-07). Online a duração vem da resposta do
    // checkout; offline é calculada a partir da entrada guardada.
    agendarFeedback({
      visitaId: visita.id,
      hospitalId: visita.hospitalId,
      hospitalNome: null,
      saidaEm: new Date().toISOString(),
      duracaoMinutos,
    }).catch((erro) => {
      // Não bloqueia o encerramento local da visita: só registra a falha.
      // eslint-disable-next-line no-console
      console.warn("GeofencingTaskService: falha ao agendar o feedback", erro?.message);
    });
    await alterarEstado((estado) => {
      if (estado.visita?.id === visita.id) {
        estado.visita = null;
      }
    });
  };

  try {
    const resposta = await VisitaService.checkout(visita.id, {});
    await encerrarLocalmente(resposta?.duracaoMinutos);
    void invalidarVisitaAtiva();
  } catch (erro) {
    // Sem internet, o checkout ficou na fila offline (OPS-05) com o horário real
    // da saída: a entrega está garantida, então o app pode encerrar a visita
    // localmente. Insistir aqui só reenfileiraria o mesmo evento.
    if (erro?.enfileirado) {
      await encerrarLocalmente(duracaoMinutosDesde(visita.entrada));
      return;
    }

    // A visita já não está aberta no servidor (encerrada à mão, expirada pelo job ou já
    // fechada): esquecê-la aqui, senão ela bloquearia o próximo checkout automático.
    if (erro?.status === 404 || erro?.status === 409) {
      await alterarEstado((estado) => {
        if (estado.visita?.id === visita.id) {
          estado.visita = null;
        }
      });
      void invalidarVisitaAtiva();
      return;
    }

    // eslint-disable-next-line no-console
    console.warn("GeofencingTaskService: falha ao confirmar saída", erro?.message);
  }
}

/**
 * Confirma as entradas e saídas cuja tolerância já venceu. Chamado pelo timer, por cada
 * leitura da tarefa de acompanhamento, por cada evento de região e na abertura do app —
 * qualquer um que chegue primeiro. Cada pendência é retirada do estado antes de ser
 * confirmada, então chamadas simultâneas não duplicam o check-in.
 */
export async function processarPendencias(agora = Date.now()) {
  const vencidas = await alterarEstado((estado) => {
    const saidas = Object.keys(estado.saidas).filter(
      (id) => agora - estado.saidas[id] >= TOLERANCIA_SAIDA_MS
    );
    const entradas = Object.keys(estado.entradas).filter(
      (id) => agora - estado.entradas[id] >= TOLERANCIA_ENTRADA_MS
    );
    const comInstante = entradas.map((id) => ({ hospitalId: id, desde: estado.entradas[id] }));
    saidas.forEach((id) => delete estado.saidas[id]);
    entradas.forEach((id) => delete estado.entradas[id]);
    return { saidas, entradas: comInstante };
  });

  // Saídas antes das entradas: quem deixa um hospital e entra em outro encerra a visita
  // anterior antes de abrir a nova.
  for (const hospitalId of vencidas.saidas) {
    await confirmarSaida(hospitalId);
  }
  for (const { hospitalId, desde } of vencidas.entradas) {
    const tentarDeNovo = await confirmarEntrada(hospitalId);
    if (tentarDeNovo && agora - desde < LIMITE_NOVA_TENTATIVA_ENTRADA_MS) {
      // Volta para a fila com o instante original: a próxima leitura do acompanhamento
      // (≈30 s) ou o timer tenta de novo, até a pessoa sair ou o limite vencer.
      await alterarEstado((estado) => {
        if (!estado.entradas[hospitalId]) {
          estado.entradas[hospitalId] = desde;
        }
      });
      agendarAvaliacao(INTERVALO_NOVA_TENTATIVA_MS);
    }
  }

  await ajustarAcompanhamento();
}

/** Liga as atualizações de localização enquanto houver pendência; desliga quando não. */
// Roda na mesma fila do estado: ler "há pendência?" e ligar/desligar o GPS é uma
// operação só, senão uma chamada que viu o estado vazio desliga o acompanhamento que
// outra acabou de ligar para uma entrada nova.
function ajustarAcompanhamento() {
  return emSerie(ajustarAcompanhamentoEmSerie);
}

async function ajustarAcompanhamentoEmSerie() {
  const { entradas, saidas } = await lerEstado();
  const haPendencia = Object.keys(entradas).length > 0 || Object.keys(saidas).length > 0;

  try {
    const ligado = await Location.hasStartedLocationUpdatesAsync(ACOMPANHAMENTO_TASK);
    if (haPendencia && !ligado) {
      await Location.startLocationUpdatesAsync(ACOMPANHAMENTO_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30 * 1000,
        distanceInterval: 0,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType?.Other,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "Radar Saúde",
          notificationBody: "Confirmando sua chegada ou saída do hospital.",
          notificationColor: "#006193",
        },
      });
    } else if (!haPendencia && ligado) {
      await Location.stopLocationUpdatesAsync(ACOMPANHAMENTO_TASK);
    }
  } catch (erro) {
    // Sem o acompanhamento, o timer e a próxima abertura do app ainda confirmam a
    // pendência — com atraso, mas sem perder o evento, que está salvo no estado.
    // eslint-disable-next-line no-console
    console.warn("GeofencingTaskService: acompanhamento indisponível", erro?.message);
  }
}

async function registrarEvento(eventType, hospitalId) {
  const agora = Date.now();

  const tolerancia = await alterarEstado((estado) => {
    if (eventType === Location.GeofencingEventType.Enter) {
      delete estado.saidas[hospitalId];
      // Mesmo com visita guardada para este hospital, a entrada é registrada: o estado
      // local pode estar velho (checkout manual, expiração no servidor) e o check-in
      // repetido é seguro — o backend devolve a visita ativa existente (RN-03).
      if (!estado.entradas[hospitalId]) {
        estado.entradas[hospitalId] = agora;
        return TOLERANCIA_ENTRADA_MS;
      }
    } else if (eventType === Location.GeofencingEventType.Exit) {
      // Saiu antes dos 2 minutos: era alguém passando em frente, não uma visita.
      delete estado.entradas[hospitalId];
      const visita = estado.visita;
      const ehDaVisita = visita && (!visita.hospitalId || visita.hospitalId === hospitalId);
      if (ehDaVisita && !estado.saidas[hospitalId]) {
        estado.saidas[hospitalId] = agora;
        return TOLERANCIA_SAIDA_MS;
      }
    }
    return null;
  });

  if (tolerancia) {
    agendarAvaliacao(tolerancia);
  }
  await processarPendencias(agora);
}

TaskManager.defineTask(GEOFENCING_TASK, async ({ data, error }) => {
  if (error) {
    return;
  }

  const { eventType, region } = data || {};
  const hospitalId = region?.identifier;

  if (!hospitalId) {
    return;
  }

  try {
    if (hospitalId === REGIAO_RECALCULO) {
      if (eventType === Location.GeofencingEventType.Exit) {
        await iniciarGeofencing({ interativo: false });
      }
      return;
    }

    await registrarEvento(eventType, hospitalId);
  } catch (erro) {
    // eslint-disable-next-line no-console
    console.warn("GeofencingTaskService: falha ao tratar evento de região", erro?.message);
  }
});

TaskManager.defineTask(ACOMPANHAMENTO_TASK, async ({ error }) => {
  if (error) {
    return;
  }
  try {
    await processarPendencias();
  } catch {
    // A próxima leitura (≈30 s) tenta de novo.
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

function perguntar(titulo, mensagem, confirmar) {
  return new Promise((resolve) => {
    Alert.alert(
      titulo,
      mensagem,
      [
        { text: "Agora não", style: "cancel", onPress: () => resolve(false) },
        { text: confirmar, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

async function explicacaoDispensadaRecentemente() {
  try {
    const em = Number(await AsyncStorage.getItem(CHAVE_EXPLICACAO_DISPENSADA));
    return Number.isFinite(em) && Date.now() - em < INTERVALO_NOVA_EXPLICACAO_MS;
  } catch {
    return false;
  }
}

/**
 * Permissões de localização. A "o tempo todo" (Android ACCESS_BACKGROUND_LOCATION / iOS
 * "Sempre") é a única que deixa o SO acordar o app na chegada ao hospital; antes de
 * pedi-la, o app explica para que serve (a política do Google Play exige essa
 * divulgação antes do pedido). Em segundo plano (`interativo: false`) nada é pedido,
 * só conferido.
 */
async function garantirPermissoes(interativo) {
  const foreground = interativo
    ? await Location.requestForegroundPermissionsAsync()
    : await Location.getForegroundPermissionsAsync();
  if (foreground?.status !== "granted") {
    return false;
  }

  const atual = await Location.getBackgroundPermissionsAsync();
  if (atual?.status === "granted") {
    return true;
  }
  if (!interativo || atual?.canAskAgain === false) {
    return false;
  }
  if (await explicacaoDispensadaRecentemente()) {
    return false;
  }

  const aceitou = await perguntar(
    "Check-in automático",
    Platform.OS === "ios"
      ? "Para registrar sua chegada e saída do hospital sem você abrir o app, escolha " +
          "\"Sempre\" no próximo aviso. A localização só é usada perto de hospitais, para " +
          "confirmar a visita."
      : "Para registrar sua chegada e saída do hospital sem você abrir o app, escolha " +
          "\"Permitir o tempo todo\" na próxima tela. A localização só é usada perto de " +
          "hospitais, para confirmar a visita.",
    "Continuar"
  );
  if (!aceitou) {
    try {
      await AsyncStorage.setItem(CHAVE_EXPLICACAO_DISPENSADA, String(Date.now()));
    } catch {
      // Sem registro, a explicação só aparece de novo na próxima abertura.
    }
    return false;
  }

  const pedido = await Location.requestBackgroundPermissionsAsync();
  return pedido?.status === "granted";
}

/**
 * Monta as regiões circulares a partir do centroide do geofence dos hospitais mais
 * próximos (E2-01/E2-02), mais a região de recálculo, e inicia o geofencing nativo.
 * Idempotente: chamadas repetidas reiniciam a lista de regiões monitoradas. Também
 * confirma pendências que venceram enquanto o app estava fechado.
 */
export async function iniciarGeofencing({ interativo = true } = {}) {
  const minhaGeracao = geracao;
  if (!(await garantirPermissoes(interativo))) {
    return;
  }

  await processarPendencias();

  let posicaoInicial;
  try {
    posicaoInicial = await comTimeout(Location.getCurrentPositionAsync({}), TIMEOUT_LEITURA_GPS_MS);
  } catch {
    posicaoInicial = await Location.getLastKnownPositionAsync({
      maxAge: IDADE_MAXIMA_POSICAO_MS,
    }).catch(() => null);
  }
  if (!posicaoInicial) {
    return;
  }
  const origem = {
    latitude: posicaoInicial.coords.latitude,
    longitude: posicaoInicial.coords.longitude,
  };

  let lista;
  try {
    const hospitais = await HospitalService.listar({
      ...origem,
      raioKm: RAIO_BUSCA_HOSPITAIS_KM,
      size: 50,
    });
    lista = hospitais?.content || hospitais || [];
  } catch {
    // Na abertura do app, as regiões que já estão registradas continuam valendo. No
    // recálculo em segundo plano a região antiga já ficou para trás: sem registrar uma
    // nova, nenhum recálculo aconteceria mais até o usuário abrir o app.
    if (interativo) {
      return;
    }
    lista = null;
  }

  const regioes = (lista || [])
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
        distancia: haversineMetros(origem, centroide) ?? Number.MAX_VALUE,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, MAX_REGIOES_HOSPITAIS);

  // A região de recálculo tem metade da distância ao hospital monitorado mais distante:
  // ao sair dela, ainda não se chegou a nenhum hospital que ficou de fora da lista. Sem
  // hospital por perto, vale o teto; sem lista (falha de rede), um raio curto.
  let raioRecalculo = RAIO_RECALCULO_MAX_METROS;
  if (lista === null) {
    raioRecalculo = RAIO_RECALCULO_SEM_LISTA_METROS;
  } else if (regioes.length > 0) {
    const maisDistante = regioes[regioes.length - 1].distancia;
    raioRecalculo = Math.max(
      PISO_RAIO_DISPARO_METROS,
      Math.min(RAIO_RECALCULO_MAX_METROS, maisDistante / 2)
    );
  }

  if (minhaGeracao !== geracao) {
    return;
  }

  await Location.startGeofencingAsync(GEOFENCING_TASK, [
    ...regioes.map(({ distancia: _distancia, ...regiao }) => regiao),
    {
      identifier: REGIAO_RECALCULO,
      ...origem,
      radius: raioRecalculo,
      notifyOnEnter: false,
      notifyOnExit: true,
    },
  ]);
}

/**
 * Informa a este serviço qual visita está ativa (para confirmar o checkout automático).
 * Chamado com o resultado de `buscarAtiva()` sempre que a Home ganha foco.
 */
export async function sincronizarVisitaAtiva(visitaId, entrada = null, hospitalId = null) {
  await alterarEstado((estado) => {
    if (!visitaId) {
      estado.visita = null;
      estado.saidas = {};
      return;
    }
    const anterior = estado.visita?.id === visitaId ? estado.visita : null;
    if (!anterior) {
      // Visita nova (ex.: check-in manual): saídas pendentes eram da visita anterior.
      estado.saidas = {};
    }
    estado.visita = {
      id: visitaId,
      hospitalId: hospitalId || anterior?.hospitalId || null,
      entrada: entrada || anterior?.entrada || null,
    };
  });
  await ajustarAcompanhamento();
}

/** Encerra o geofencing nativo, o acompanhamento e limpa o estado (ex.: logout). */
export async function pararGeofencing() {
  geracao += 1;
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  await alterarEstado((estado) => {
    estado.visita = null;
    estado.entradas = {};
    estado.saidas = {};
  });

  if (await Location.hasStartedLocationUpdatesAsync(ACOMPANHAMENTO_TASK)) {
    await Location.stopLocationUpdatesAsync(ACOMPANHAMENTO_TASK);
  }

  const tarefaRegistrada = await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK);
  if (tarefaRegistrada) {
    await Location.stopGeofencingAsync(GEOFENCING_TASK);
  }
}
