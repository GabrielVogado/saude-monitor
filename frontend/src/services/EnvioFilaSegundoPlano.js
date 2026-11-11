import { Platform } from "react-native";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

import { tamanhoDaFila } from "../config/filaOffline";
import { registrarErro } from "../config/monitoramento";
import { sincronizar } from "./SincronizacaoOffline";

/**
 * Envio periódico da fila offline com o app fechado (M-075, decisão do PO em 04/11/2026,
 * liberada após o teste de campo do #243 em 11/11/2026).
 *
 * Até aqui a fila só saía com o app aberto ou quando o SO acordava o app para o
 * geofencing (entrada, saída ou leitura do acompanhamento). Quem saía do hospital sem
 * internet e não passava perto de outro ponto monitorado deixava a saída guardada até
 * abrir o app. Esta tarefa pede ao SO (WorkManager no Android, BGTaskScheduler no iOS)
 * uma janela a cada ~15 minutos, o mínimo que o Android aceita; o SO pode atrasar a
 * janela para poupar bateria, mas não a perde.
 *
 * A tarefa fica registrada sempre, mesmo com a fila vazia: o registro é persistido pelo
 * SO, e ligá-lo só quando um item entra exigiria o JS rodando nesse momento, o que nem
 * sempre acontece (a saída pode ser guardada pelo próprio geofencing). Com a fila vazia
 * a rodada só lê o armazenamento local e termina, sem rede.
 *
 * `defineTask` precisa rodar no carregamento do bundle (por isso o import em `index.js`,
 * depois do geofencing, que registra o observador da fila).
 */
export const ENVIO_FILA_TASK = "saude-monitor-envio-fila";

/** Intervalo pedido ao SO, em minutos (o Android não aceita menos que 15). */
export const INTERVALO_ENVIO_EM_MINUTOS = 15;

/** Uma rodada da tarefa: envia a fila se houver algo nela. */
export async function executarEnvioDaFila() {
  try {
    if ((await tamanhoDaFila()) === 0) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }
    await sincronizar();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    registrarErro(error, "fila.segundoPlano");
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
}

/**
 * Pede ao SO a execução periódica. Não registra de novo o que já está registrado, para
 * cada abertura do app não reiniciar a contagem do intervalo. No navegador não existe
 * tarefa de segundo plano, e uma falha aqui não pode impedir o app de abrir.
 */
export async function registrarEnvioPeriodico() {
  if (Platform.OS === "web") {
    return false;
  }
  try {
    if (await TaskManager.isTaskRegisteredAsync(ENVIO_FILA_TASK)) {
      return true;
    }
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
      return false;
    }
    await BackgroundTask.registerTaskAsync(ENVIO_FILA_TASK, {
      minimumInterval: INTERVALO_ENVIO_EM_MINUTOS,
    });
    return true;
  } catch (error) {
    registrarErro(error, "fila.registroSegundoPlano");
    return false;
  }
}

if (Platform.OS !== "web") {
  TaskManager.defineTask(ENVIO_FILA_TASK, executarEnvioDaFila);
}

// Disparo intencional: o resultado só importa para os testes.
void registrarEnvioPeriodico();
