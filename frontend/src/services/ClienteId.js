import AsyncStorage from "@react-native-async-storage/async-storage";
import { uuid } from "expo-modules-core";

/**
 * Identificador da instalação do app, enviado sem login no cabeçalho `X-Cliente-Id`
 * (ARQ-02). O backend usa o id como chave do rate limit das rotas públicas: atrás do
 * CGNAT das operadoras, centenas de celulares saem pelo mesmo IP, e o limite por IP fazia
 * o pico de uns bloquear o check-in e o heartbeat dos outros.
 *
 * É um id separado do `dispositivoId` de propósito. O `dispositivoId` é a prova de dono
 * da visita anônima (SEG-02) e não deve viajar em cada cabeçalho; este não dá acesso a
 * nada, só separa o contador de cada instalação.
 */

const CHAVE_CLIENTE = "@saude_monitor:clienteId";

async function lerOuCriar() {
  const existente = await AsyncStorage.getItem(CHAVE_CLIENTE);
  if (existente) {
    return existente;
  }
  const novo = uuid.v4();
  await AsyncStorage.setItem(CHAVE_CLIENTE, novo);
  return novo;
}

/** Leitura compartilhada pelas chamadas simultâneas da primeira execução (um id só). */
let leituraEmAndamento = null;

class ClienteId {
  /**
   * Id da instalação, gerado e persistido na primeira chamada, ou `undefined` se o
   * armazenamento falhar: o cabeçalho só complementa o pedido, nunca o impede.
   */
  static async obterSeDisponivel() {
    if (!leituraEmAndamento) {
      leituraEmAndamento = lerOuCriar().finally(() => {
        leituraEmAndamento = null;
      });
    }
    try {
      return await leituraEmAndamento;
    } catch {
      return undefined;
    }
  }
}

export default ClienteId;
