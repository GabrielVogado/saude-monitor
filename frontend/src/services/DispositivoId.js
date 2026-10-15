import AsyncStorage from "@react-native-async-storage/async-storage";
import { uuid } from "expo-modules-core";

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

/**
 * O id é a única credencial de quem usa o app sem login: quem o adivinhar consegue
 * agir sobre a visita ativa daquele aparelho. Por isso vem de um gerador
 * criptográfico — o UUID v4 nativo do `expo-modules-core` (já embarcado pelo `expo`:
 * `java.util.UUID.randomUUID()`/`SecureRandom` no Android, `UUID()` no iOS e
 * `crypto.randomUUID()` na web) — e não de `Math.random`, cuja sequência é previsível.
 */
function gerarId() {
  return `anon-${uuid.v4()}`;
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