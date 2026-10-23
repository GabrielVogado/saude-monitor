import AsyncStorage from "@react-native-async-storage/async-storage";

import { ErroDeTimeout, ErroSemInternet, ErroServidorIndisponivel } from "../../config/http";
import { enfileirar, itensDaFila } from "../../config/filaOffline";
import VisitaService from "../../screens/visitas/service/VisitaService";
import { MAX_TENTATIVAS, sincronizar } from "../../services/SincronizacaoOffline";

jest.mock("../../screens/visitas/service/VisitaService", () => ({
  __esModule: true,
  default: { enviarEventoOffline: jest.fn() },
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
