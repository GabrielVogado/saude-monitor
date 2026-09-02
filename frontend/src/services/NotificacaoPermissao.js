import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Permissão de notificação do dispositivo, isolada do fluxo que a consome.
 *
 * Nasceu dentro do feedback pós-saída (E3-01), mas o opt-in também é oferecido
 * na tela dedicada de notificações do Perfil (E6-05) — por isso vive aqui, e não
 * no `FeedbackNotificationService`.
 */

/** Canal Android das notificações de feedback (E3-01). */
export const CANAL_FEEDBACK = "feedback";

/**
 * Garante o canal Android antes de pedir a permissão. Sem canal, o Android não
 * exibe a notificação mesmo com a permissão concedida.
 */
export async function garantirCanalFeedback() {
  if (Platform.OS !== "android" || Platform.constants?.isTesting) {
    return;
  }
  await Notifications.setNotificationChannelAsync(CANAL_FEEDBACK, {
    name: "Feedback após a visita",
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/**
 * Status atual da permissão, sem pedir nada ao usuário.
 *
 * @returns {Promise<"granted"|"denied"|"undetermined">}
 */
export async function statusPermissaoNotificacao() {
  const atual = await Notifications.getPermissionsAsync();
  if (atual?.granted) {
    return "granted";
  }
  return atual?.canAskAgain === false || atual?.status === "denied" ? "denied" : "undetermined";
}

/**
 * Pede a permissão de notificação. Não é obrigatória (o feedback segue disponível
 * dentro do app), mas sem ela o pedido pós-saída não aparece.
 *
 * @returns {Promise<boolean>} se a permissão está concedida ao final
 */
export async function solicitarPermissaoNotificacao() {
  const atual = await Notifications.getPermissionsAsync();
  if (atual?.granted) {
    return true;
  }

  await garantirCanalFeedback();

  const solicitada = await Notifications.requestPermissionsAsync();
  return Boolean(solicitada?.granted);
}
