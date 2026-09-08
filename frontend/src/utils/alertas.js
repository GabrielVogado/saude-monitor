import { Alert } from "react-native";

/**
 * Alerta para um evento enfileirado offline (OPS-05 — check-in/check-out sem
 * internet). O título nunca pode soar como falha: o evento foi guardado com
 * sucesso e será sincronizado assim que a conexão voltar.
 */
export function avisarSemConexao(mensagem) {
  Alert.alert("Sem conexão", mensagem);
}
