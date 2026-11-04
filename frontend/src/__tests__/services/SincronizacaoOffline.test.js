import AsyncStorage from "@react-native-async-storage/async-storage";

import { ErroDeTimeout, ErroSemInternet, ErroServidorIndisponivel } from "../../config/http";
import { enfileirar, itensDaFila } from "../../config/filaOffline";
import VisitaService from "../../screens/visitas/service/VisitaService";
import { MAX_TENTATIVAS, definirObservador, sincronizar } from "../../services/SincronizacaoOffline";

jest.mock("../../screens/visitas/service/VisitaService", () => ({
  __esModule: true,
  default: { enviarEventoOffline: jest.fn(), buscarAtiva: jest.fn() },
}));

/**
 * OPS-05 — reenvio do que ficou na fila.
 *
 * A regra de ouro aqui é distinguir três desfechos: entregue (some da fila),
 * recusado de vez (some da fila, senão trava tudo atrás dele) e ainda sem
 * conexão (permanece intacto, sem gastar tentativa).
 */
describe("OPS-05 — sincronização da fila offline", () => {
  beforeEach(async () => {
    AsyncStorage.__reset();
    jest.clearAllMocks();
  });

  it("envia o que estava guardado e esvazia a fila", async () => {
    VisitaService.enviarEventoOffline.mockResolvedValue({ id: "v1" });
    await enfileirar({ chave: "checkin:h1", tipo: "checkin", corpo: { hospitalId: "h1" } });

    const resultado = await sincronizar();

    expect(VisitaService.enviarEventoOffline).toHaveBeenCalledWith(
      expect.objectContaining({ chave: "checkin:h1", tipo: "checkin" })
    );
    expect(resultado).toMatchObject({ enviados: 1, descartados: 0, pendentes: 0 });
  });

  it("mantém o evento na fila enquanto o aparelho segue sem internet", async () => {
    VisitaService.enviarEventoOffline.mockRejectedValue(new ErroSemInternet());
    await enfileirar({ chave: "checkin:h1", tipo: "checkin", corpo: {} });

    const resultado = await sincronizar();

    expect(resultado).toMatchObject({ enviados: 0, descartados: 0, pendentes: 1 });
    // Sem gastar tentativa: não foi o evento que falhou, foi a rede.
    expect((await itensDaFila())[0].tentativas).toBe(0);
  });

  it("para na primeira falta de conexão, preservando a ordem dos eventos", async () => {
    VisitaService.enviarEventoOffline.mockRejectedValue(new ErroSemInternet());
    await enfileirar({ chave: "checkin:h1", tipo: "checkin", corpo: {} });
    await enfileirar({ chave: "checkout:v1", tipo: "checkout", corpo: {} });

    await sincronizar();

    expect(VisitaService.enviarEventoOffline).toHaveBeenCalledTimes(1);
  });

  /**
   * Teste de campo de 23/10/2026: com sinal fraco, cinco timeouts seguidos descartavam o
   * checkout guardado, e a visita ficava como GPS interrompido com 0 min.
   */
  it.each([
    ["timeout", () => new ErroDeTimeout("https://api/visitas", 20000)],
    ["servidor indisponível", () => new ErroServidorIndisponivel("https://api/visitas")],
    ["5xx", () => Object.assign(new Error("falha"), { status: 503 })],
  ])("%s mantém o evento sem gastar tentativa", async (_nome, criarErro) => {
    VisitaService.enviarEventoOffline.mockRejectedValue(criarErro());
    await enfileirar({ chave: "checkout:v1", tipo: "checkout", corpo: { visitaId: "v1" } });

    for (let i = 0; i < MAX_TENTATIVAS + 1; i += 1) {
      await sincronizar();
    }

    const [item] = await itensDaFila();
    expect(item).toMatchObject({ chave: "checkout:v1", tentativas: 0 });
  });

  it("descarta o evento que o servidor recusou de vez (409 de visita já encerrada)", async () => {
    const conflito = Object.assign(new Error("Visita já encerrada."), { status: 409 });
    VisitaService.enviarEventoOffline.mockRejectedValue(conflito);
    await enfileirar({ chave: "checkout:v1", tipo: "checkout", corpo: { visitaId: "v1" } });

    const resultado = await sincronizar();

    expect(resultado).toMatchObject({ enviados: 0, descartados: 1, pendentes: 0 });
  });

  it("conta a tentativa quando a falha é passageira e tenta de novo depois", async () => {
    VisitaService.enviarEventoOffline.mockRejectedValueOnce(new Error("Falha genérica"));
    await enfileirar({ chave: "checkin:h1", tipo: "checkin", corpo: {} });

    await sincronizar();
    expect((await itensDaFila())[0].tentativas).toBe(1);

    VisitaService.enviarEventoOffline.mockResolvedValueOnce({ id: "v1" });
    await expect(sincronizar()).resolves.toMatchObject({ enviados: 1, pendentes: 0 });
  });

  it("desiste do evento que falha sempre, para não travar a fila atrás dele", async () => {
    VisitaService.enviarEventoOffline.mockRejectedValue(new Error("Falha genérica"));
    await enfileirar({ chave: "checkin:h1", tipo: "checkin", corpo: {} });

    for (let i = 0; i < MAX_TENTATIVAS - 1; i += 1) {
      await sincronizar();
    }
    expect(await itensDaFila()).toHaveLength(1);

    const ultima = await sincronizar();

    expect(ultima).toMatchObject({ descartados: 1, pendentes: 0 });
  });

  it("não envia nada quando a fila está vazia", async () => {
    const resultado = await sincronizar();

    expect(VisitaService.enviarEventoOffline).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({ enviados: 0, pendentes: 0 });
  });

  it("ignora a chamada concorrente: dois gatilhos não enviam o evento duas vezes", async () => {
    // Envio que só termina quando o teste mandar: é o que mantém a primeira
    // sincronização em curso enquanto a segunda é disparada.
    let liberar;
    const envioPendente = new Promise((resolve) => { liberar = resolve; });
    VisitaService.enviarEventoOffline.mockReturnValue(envioPendente);
    await enfileirar({ chave: "checkin:h1", tipo: "checkin", corpo: {} });

    const primeira = sincronizar();
    const segunda = await sincronizar();

    expect(segunda).toMatchObject({ ignorado: true });

    liberar({ id: "v1" });
    await expect(primeira).resolves.toMatchObject({ enviados: 1 });
    expect(VisitaService.enviarEventoOffline).toHaveBeenCalledTimes(1);
  });
});

/**
 * Teste de campo de 29/10/2026: a entrada ficou na fila e a saída também, sem número de
 * visita. A saída só pode sair depois da entrada, com o número que o servidor devolveu, e o
 * geofencing precisa saber o desfecho para acompanhar a visita certa.
 */
describe("saída que espera a entrada guardada sem internet", () => {
  const CHAVE = "checkin:h1:1";
  const ENTRADA = { chave: CHAVE, hospitalId: "h1" };
  const minutosAtras = (min) => new Date(Date.now() - min * 60 * 1000).toISOString();
  const entradaNaFila = (chave = CHAVE) =>
    enfileirar({ chave, tipo: "checkin", corpo: { hospitalId: "h1" }, ocorridoEm: minutosAtras(30) });
  const saidaNaFila = (entrada = ENTRADA, ocorridoEm = minutosAtras(5)) =>
    enfileirar({
      chave: `checkout:${entrada.chave}`,
      tipo: "checkout",
      corpo: { visitaId: null, entradaPendente: entrada, dispositivoId: "anon-1" },
      ocorridoEm,
    });
  let eventos;

  beforeEach(() => {
    AsyncStorage.__reset();
    jest.clearAllMocks();
    eventos = [];
    definirObservador((evento) => {
      eventos.push(evento);
    });
  });

  afterEach(() => {
    definirObservador(null);
  });

  it("envia a saída para a visita que a entrada acabou de abrir e avisa os dois desfechos", async () => {
    VisitaService.enviarEventoOffline.mockImplementation(async (item) =>
      item.tipo === "checkin"
        ? { id: "v42", hospitalId: "h1", entrada: "2026-11-04T12:00:00Z" }
        : { id: "v42", duracaoMinutos: 25 }
    );
    await entradaNaFila();
    await saidaNaFila();

    const resultado = await sincronizar();

    expect(resultado).toMatchObject({ enviados: 2, descartados: 0, pendentes: 0 });
    expect(VisitaService.enviarEventoOffline).toHaveBeenLastCalledWith(
      expect.objectContaining({ chave: `checkout:${CHAVE}`, corpo: expect.objectContaining({ visitaId: "v42" }) })
    );
    expect(VisitaService.buscarAtiva).not.toHaveBeenCalled();
    expect(eventos).toEqual([
      {
        tipo: "entrada",
        chaveEntrada: CHAVE,
        hospitalId: "h1",
        visitaId: "v42",
        entrada: "2026-11-04T12:00:00Z",
        saidaPendente: true,
      },
      { tipo: "saida", hospitalId: "h1", visitaId: "v42", duracaoMinutos: 25 },
    ]);
  });

  it("duas visitas seguidas na mesma unidade ficam separadas", async () => {
    let numero = 0;
    VisitaService.enviarEventoOffline.mockImplementation(async (item) => {
      if (item.tipo === "checkin") {
        numero += 1;
        return { id: `v${numero}` };
      }
      return { id: item.corpo.visitaId };
    });
    await entradaNaFila("checkin:h1:1");
    await saidaNaFila({ chave: "checkin:h1:1", hospitalId: "h1" });
    await entradaNaFila("checkin:h1:2");
    await saidaNaFila({ chave: "checkin:h1:2", hospitalId: "h1" });

    await sincronizar();

    const saidas = VisitaService.enviarEventoOffline.mock.calls
      .map(([item]) => item)
      .filter((item) => item.tipo === "checkout")
      .map((item) => item.corpo.visitaId);
    expect(saidas).toEqual(["v1", "v2"]);
  });

  it("entrada sem saída avisa que a pessoa continua lá, com o horário da fila se o servidor não mandar", async () => {
    VisitaService.enviarEventoOffline.mockResolvedValue({ id: "v42" });
    const { ocorridoEm } = await entradaNaFila();

    await sincronizar();

    expect(eventos).toEqual([
      { tipo: "entrada", chaveEntrada: CHAVE, hospitalId: "h1", visitaId: "v42", entrada: ocorridoEm, saidaPendente: false },
    ]);
  });

  it("resposta com visita de outra unidade não é tomada como a desta entrada", async () => {
    VisitaService.enviarEventoOffline.mockResolvedValue({ id: "v8", hospitalId: "h2" });
    VisitaService.buscarAtiva.mockResolvedValue({ visita: { id: "v8", hospitalId: "h2" } });
    await entradaNaFila();
    await saidaNaFila();

    const resultado = await sincronizar();

    expect(eventos).toEqual([]);
    expect(resultado).toMatchObject({ enviados: 1, descartados: 1 });
  });

  it("grava o número na saída assim que a entrada é aceita, para a próxima rodada", async () => {
    VisitaService.enviarEventoOffline
      .mockResolvedValueOnce({ id: "v42" })
      .mockRejectedValueOnce(new ErroSemInternet());
    await entradaNaFila();
    await saidaNaFila();

    await sincronizar();

    const [saida] = await itensDaFila();
    expect(saida).toMatchObject({ chave: `checkout:${CHAVE}`, tentativas: 0, corpo: { visitaId: "v42" } });
    expect(VisitaService.buscarAtiva).not.toHaveBeenCalled();
  });

  it("saída já vinculada numa rodada anterior ainda avisa para o convite de feedback", async () => {
    VisitaService.enviarEventoOffline.mockResolvedValue({ id: "v42", duracaoMinutos: 18 });
    await enfileirar({
      chave: `checkout:${CHAVE}`,
      tipo: "checkout",
      corpo: { visitaId: "v42", entradaPendente: ENTRADA },
      ocorridoEm: minutosAtras(5),
    });

    await sincronizar();

    expect(eventos).toEqual([{ tipo: "saida", hospitalId: "h1", visitaId: "v42", duracaoMinutos: 18 }]);
  });

  it("sem a entrada na fila, usa a visita aberta da mesma unidade que começou antes da saída", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({ visita: { id: "v7", hospitalId: "h1", entrada: minutosAtras(40) } });
    VisitaService.enviarEventoOffline.mockResolvedValue({ id: "v7", duracaoMinutos: 12 });
    await saidaNaFila();

    const resultado = await sincronizar();

    expect(resultado).toMatchObject({ enviados: 1, pendentes: 0 });
    expect(VisitaService.enviarEventoOffline).toHaveBeenCalledWith(
      expect.objectContaining({ corpo: expect.objectContaining({ visitaId: "v7" }) })
    );
    expect(eventos).toEqual([{ tipo: "saida", hospitalId: "h1", visitaId: "v7", duracaoMinutos: 12 }]);
  });

  it.each([
    ["sem visita aberta", { visita: null }],
    ["com visita aberta em outra unidade", { visita: { id: "v8", hospitalId: "h2", entrada: minutosAtras(40) } }],
    ["com visita aberta depois da saída (check-in manual)", { visita: { id: "v9", hospitalId: "h1", entrada: minutosAtras(1) } }],
  ])("descarta a saída %s: não há o que encerrar", async (_nome, ativa) => {
    VisitaService.buscarAtiva.mockResolvedValue(ativa);
    await saidaNaFila();

    const resultado = await sincronizar();

    expect(resultado).toMatchObject({ enviados: 0, descartados: 1, pendentes: 0 });
    expect(VisitaService.enviarEventoOffline).not.toHaveBeenCalled();
  });

  it("entrada recusada avisa e leva junto a saída, sem procurar outra visita", async () => {
    VisitaService.enviarEventoOffline.mockRejectedValue(Object.assign(new Error("Fora do hospital"), { status: 422 }));
    await entradaNaFila();
    await saidaNaFila();

    const resultado = await sincronizar();

    expect(resultado).toMatchObject({ enviados: 0, descartados: 2, pendentes: 0 });
    expect(VisitaService.buscarAtiva).not.toHaveBeenCalled();
    expect(eventos).toEqual([{ tipo: "entradaRecusada", chaveEntrada: CHAVE, hospitalId: "h1" }]);
  });

  it("sem internet para conferir a visita aberta, a saída espera sem gastar tentativa", async () => {
    VisitaService.buscarAtiva.mockRejectedValue(new ErroSemInternet());
    await saidaNaFila();

    await sincronizar();

    expect((await itensDaFila())[0]).toMatchObject({ chave: `checkout:${CHAVE}`, tentativas: 0 });
  });

  it("recusa ao conferir a visita aberta (sessão vencida) gasta tentativa, mas não descarta a saída", async () => {
    VisitaService.buscarAtiva.mockRejectedValue(Object.assign(new Error("Não autorizado"), { status: 401 }));
    await saidaNaFila();

    await sincronizar();

    expect((await itensDaFila())[0]).toMatchObject({ chave: `checkout:${CHAVE}`, tentativas: 1 });
  });

  it("falha de quem observa não trava a fila", async () => {
    definirObservador(() => {
      throw new Error("estado");
    });
    VisitaService.enviarEventoOffline.mockResolvedValue({ id: "v42" });
    await entradaNaFila();

    await expect(sincronizar()).resolves.toMatchObject({ enviados: 1, pendentes: 0 });
  });

  it("checkout comum não gera aviso", async () => {
    VisitaService.enviarEventoOffline.mockResolvedValue({ id: "v1" });
    await enfileirar({ chave: "checkout:v1", tipo: "checkout", corpo: { visitaId: "v1" } });

    await sincronizar();

    expect(eventos).toEqual([]);
  });
});
