import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Identificação anônima de dispositivo (modo anônimo — §3.3).
 *
 * O backend aceita check-in/check-out/heartbeat de visitas sem login, desde que o
 * app informe um `dispositivoId`. Para que o usuário NÃO precise identificar o
 * dispositivo manualmente, o app gera um id anônimo na primeira execução e o
 * persiste localmente — reutilizando-o em todas as chamadas anônimas.
 *
 * Este id não identifica a pessoa, apenas isola a "sessão de dispositivo" para o
 * ciclo de vida da visita (idempotência e recuperação da visita ativa).
 */

const CHAVE_DISPOSITIVO = "@saude_monitor:dispositivoId";

function gerarId() {
  // UUID v4 aproximado (random puro): suficiente para identificação anônima não
  // crítica; evita nova dependência nativa (expo-crypto/application) para o MVP.
  const hex = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .padStart(4, "0");
  return (
    `anon-${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}` +
    `-${Date.now().toString(36)}`
  );
}

class DispositivoId {
  /** Retorna o id anônimo do dispositivo, gerando e persistindo se ainda não existir. */
  static async obter() {
    const existente = await AsyncStorage.getItem(CHAVE_DISPOSITIVO);
    if (existente) {
      return existente;
    }

    const novo = gerarId();
    await AsyncStorage.setItem(CHAVE_DISPOSITIVO, novo);
    return novo;
  }
}

export default DispositivoId;