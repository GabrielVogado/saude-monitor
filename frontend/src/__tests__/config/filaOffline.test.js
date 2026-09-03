import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  LIMITE_ITENS,
  VALIDADE_MS,
  enfileirar,
  itensDaFila,
  limparFila,
  marcarTentativa,
  removerDaFila,
  tamanhoDaFila,
} from "../../config/filaOffline";

/**
 * OPS-05 — fila de eventos pendentes.
 *
 * O que estes testes protegem é a promessa que a fila faz ao usuário e ao dado:
 * o evento não se perde, não é enviado duas vezes e não chega ao servidor com a
 * hora errada.
 */
describe("OPS-05 — fila offline", () => {
  beforeEach(() => {
    AsyncStorage.__reset();
  });

  it("guarda o evento e o devolve para envio posterior", async () => {
    await enfileirar({
      chave: "checkin:h1",
      tipo: "checkin",
      corpo: { hospitalId: "h1", origem: "GEOFENCE" },
    });

    const itens = await itensDaFila();

    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({
      chave: "checkin:h1",
      tipo: "checkin",
      corpo: { hospitalId: "h1", origem: "GEOFENCE" },
      tentativas: 0,
    });
  });

  it("registra o momento do evento, não o do envio", async () => {
    const antes = Date.now();
    await enfileirar({ chave: "checkin:h1", tipo: "checkin", corpo: {} });
    const [item] = await itensDaFila();

    const registrado = new Date(item.ocorridoEm).getTime();

    expect(registrado).toBeGreaterThanOrEqual(antes);
    expect(registrado).toBeLessThanOrEqual(Date.now());
  });

  it("preserva o `ocorridoEm` informado, para o reenvio manter a hora real", async () => {
    const quando = "2026-09-03T10:15:00.000Z";

    await enfileirar({
      chave: "checkout:v1",
      tipo: "checkout",
      corpo: { visitaId: "v1" },
      ocorridoEm: quando,
    });

    expect((await itensDaFila())[0].ocorridoEm).toBe(quando);
  });

  it("substitui o item de mesma chave em vez de empilhar cópias do mesmo fato", async () => {
    await enfileirar({ chave: "checkout:v1", tipo: "checkout", corpo: { tentativa: 1 } });
    await enfileirar({ chave: "checkout:v1", tipo: "checkout", corpo: { tentativa: 2 } });

    const itens = await itensDaFila();

    expect(itens).toHaveLength(1);
    expect(itens[0].corpo).toEqual({ tentativa: 2 });
  });

  it("mantém eventos distintos lado a lado, do mais antigo para o mais novo", async () => {
    await enfileirar({ chave: "checkin:h1", tipo: "checkin", corpo: {} });
    await enfileirar({ chave: "checkout:v1", tipo: "checkout", corpo: {} });

    expect((await itensDaFila()).map((i) => i.chave)).toEqual([
      "checkin:h1",
      "checkout:v1",
    ]);
  });

  it("descarta o evento vencido: depois de 24h ele criaria registro falso", async () => {
    const vencido = new Date(Date.now() - VALIDADE_MS - 1000).toISOString();

    await enfileirar({
      chave: "checkin:h1",
      tipo: "checkin",
      corpo: {},
      ocorridoEm: vencido,
    });

    expect(await tamanhoDaFila()).toBe(0);
  });

  it("limita o tamanho da fila, preservando os eventos mais recentes", async () => {
    for (let i = 0; i < LIMITE_ITENS + 5; i += 1) {
      await enfileirar({ chave: `checkin:h${i}`, tipo: "checkin", corpo: { i } });
    }

    const itens = await itensDaFila();

    expect(itens).toHaveLength(LIMITE_ITENS);
    expect(itens[itens.length - 1].corpo.i).toBe(LIMITE_ITENS + 4);
  });

  it("conta a tentativa fracassada sem perder o evento", async () => {
    await enfileirar({ chave: "checkin:h1", tipo: "checkin", corpo: {} });

    await marcarTentativa("checkin:h1");
    await marcarTentativa("checkin:h1");

    expect((await itensDaFila())[0].tentativas).toBe(2);
  });

  it("remove o evento entregue", async () => {
    await enfileirar({ chave: "checkin:h1", tipo: "checkin", corpo: {} });
    await removerDaFila("checkin:h1");

    expect(await tamanhoDaFila()).toBe(0);
  });

  it("sobrevive a conteúdo corrompido no armazenamento", async () => {
    await AsyncStorage.setItem("@saude_monitor:filaOffline", "{isto não é json");

    await expect(itensDaFila()).resolves.toEqual([]);
    await expect(
      enfileirar({ chave: "checkin:h1", tipo: "checkin", corpo: {} })
    ).resolves.toMatchObject({ chave: "checkin:h1" });
  });

  it("limpa a fila inteira", async () => {
    await enfileirar({ chave: "checkin:h1", tipo: "checkin", corpo: {} });
    await limparFila();

    expect(await tamanhoDaFila()).toBe(0);
  });
});
