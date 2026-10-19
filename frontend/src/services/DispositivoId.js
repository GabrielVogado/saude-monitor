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

async function lerOuCriar() {
  const existente = await AsyncStorage.getItem(CHAVE_DISPOSITIVO);
  if (existente) {
    return existente;
  }

  const novo = gerarId();
  await AsyncStorage.setItem(CHAVE_DISPOSITIVO, novo);
  return novo;
}

/**
 * Leitura em andamento, compartilhada por chamadas simultâneas. Sem isso, duas chamadas
 * na primeira execução podiam gerar ids diferentes; com o id virando a prova de dono da
 * visita anônima (SEG-02), o check-in gravaria um e o checkout mandaria o outro (403).
 */
let leituraEmAndamento = null;

class DispositivoId {
  /** Retorna o id anônimo do dispositivo, gerando e persistindo se ainda não existir. */
  static obter() {
    if (!leituraEmAndamento) {
      leituraEmAndamento = lerOuCriar().finally(() => {
        leituraEmAndamento = null;
      });
    }
    return leituraEmAndamento;
  }

  /**
   * Como `obter`, mas devolve `undefined` se o armazenamento falhar. Para chamadas em que
   * o id só complementa o pedido e a falha não pode impedir o envio nem a fila offline.
   */
  static async obterSeDisponivel() {
    try {
      return await DispositivoId.obter();
    } catch {
      return undefined;
    }
  }
}

export default DispositivoId;