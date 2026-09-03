/**
 * Ciclo de vida de visitas (Épico 02) — VisitaService.
 * Contrato §3.3: checkin/checkout/heartbeat e busca de ativa/histórico.
 */
import * as Network from "expo-network";

import VisitaService from "../../../screens/visitas/service/VisitaService";
import TokenStorage from "../../../services/TokenStorage";
import LoginService from "../../../screens/auth/service/LoginService";
import { itensDaFila, limparFila } from "../../../config/filaOffline";

process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";

jest.mock("../../../screens/auth/service/LoginService");

function jsonResponse(body, status = 200) {
  return { ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body };
}

describe("VisitaService (Épico 02)", () => {
  let chamadas;
  beforeEach(async () => {
    require("@react-native-async-storage/async-storage").default.__reset();
    jest.clearAllMocks();
    chamadas = [];
    global.fetch = jest.fn().mockImplementation(async (url, config) => {
      chamadas.push({ url, method: config?.method || "GET", body: config?.body });
      return jsonResponse({ id: "v1" });
    });
  });

  test("checkin faz POST em /checkin com origem e posicao", async () => {
    await VisitaService.checkin({
      hospitalId: "h1",
      origem: "GEOFENCE",
      posicao: { type: "Point", coordinates: [-47.88, -15.79] },
    });
    const c = chamadas[0];
    expect(c.method).toBe("POST");
    expect(c.url).toContain("/api/v1/visitas/checkin");
    const body = JSON.parse(c.body);
    expect(body.hospitalId).toBe("h1");
    expect(body.origem).toBe("GEOFENCE");
  });

  test("checkin anônimo anexa dispositivoId automaticamente (modo sem login)", async () => {
    await VisitaService.checkin({ hospitalId: "h1", origem: "MANUAL" });

    const body = JSON.parse(chamadas[0].body);
    expect(body.dispositivoId).toBeTruthy();
    expect(body.dispositivoId).toContain("anon-");
  });

  test("checkin autenticado NÃO envia dispositivoId", async () => {
    await TokenStorage.salvarTokens({ accessToken: "TOK", refreshToken: "R" });
    await VisitaService.checkin({ hospitalId: "h1", origem: "MANUAL" });

    const body = JSON.parse(chamadas[0].body);
    expect(body.dispositivoId).toBeUndefined();
  });

  test("checkout faz POST em /checkout com encerramentoManual", async () => {
    await VisitaService.checkout("v1", { encerramentoManual: true });
    const c = chamadas[0];
    expect(c.method).toBe("POST");
    expect(c.url).toContain("/api/v1/visitas/v1/checkout");
    expect(JSON.parse(c.body).encerramentoManual).toBe(true);
  });

  test("heartbeat envia posição quando disponível", async () => {
    const posicao = { type: "Point", coordinates: [-47.88, -15.79] };
    await VisitaService.heartbeat("v1", posicao);
    const c = chamadas[0];
    expect(c.url).toContain("/api/v1/visitas/v1/heartbeat");
    expect(JSON.parse(c.body).posicao).toEqual(posicao);
  });

  test("heartbeat sem posição envia corpo vazio (sinal de vida, RN-23)", async () => {
    await VisitaService.heartbeat("v1", null);
    const body = JSON.parse(chamadas[0].body);
    expect(body.posicao).toBeUndefined();
  });

  test("buscarAtiva faz GET em /ativas", async () => {
    await VisitaService.buscarAtiva();
    expect(chamadas[0].method).toBe("GET");
    expect(chamadas[0].url).toContain("/api/v1/visitas/ativas");
  });

  test("buscarAtiva anônimo envia dispositivoId no query string", async () => {
    await VisitaService.buscarAtiva();
    const url = chamadas[0].url;
    expect(url).toContain("dispositivoId=");
    expect(url).toContain("anon-");
  });

  test("listarHistorico usa /contas/visitas com paginação", async () => {
    await VisitaService.listarHistorico({ page: 2, size: 20 });
    expect(chamadas[0].url).toContain("/api/v1/contas/visitas");
    expect(chamadas[0].url).toContain("page=2");
    expect(chamadas[0].url).toContain("size=20");
  });

  test("anexa Authorization Bearer quando há sessão", async () => {
    await TokenStorage.salvarTokens({ accessToken: "TOK", refreshToken: "R" });
    await VisitaService.buscarAtiva();
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer TOK");
    expect(chamadas[0].url).not.toContain("dispositivoId=");
  });

  test("401 renova token via refresh e tenta novamente", async () => {
    await TokenStorage.salvarTokens({ accessToken: "OLD", refreshToken: "R" });
    LoginService.refresh.mockResolvedValue({ accessToken: "NEW", refreshToken: "R2" });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "expirado" }, 401))
      .mockResolvedValueOnce(jsonResponse({ id: "v1" }));
    const resp = await VisitaService.buscarAtiva();
    expect(LoginService.refresh).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(resp.id).toBe("v1");
  });

  /**
   * OPS-05 — o caminho que a lacuna OPS-01 descreve: o check-in do geofencing
   * dispara em segundo plano, sem tela e sem usuário. Se ele falha por falta de
   * internet e ninguém guarda o evento, a visita se perde em silêncio.
   */
  describe("fila offline (OPS-05)", () => {
    const semInternet = () => {
      Network.getNetworkStateAsync.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });
      global.fetch = jest.fn().mockRejectedValue(new TypeError("Network request failed"));
    };

    beforeEach(async () => {
      await limparFila();
    });

    afterEach(() => {
      Network.getNetworkStateAsync.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      });
    });

    test("check-in sem internet vai para a fila em vez de se perder", async () => {
      semInternet();

      await expect(
        VisitaService.checkin({ hospitalId: "h1", origem: "GEOFENCE" })
      ).rejects.toMatchObject({ enfileirado: true });

      const [item] = await itensDaFila();
      expect(item).toMatchObject({ chave: "checkin:h1", tipo: "checkin" });
      expect(item.corpo.hospitalId).toBe("h1");
      expect(item.ocorridoEm).toEqual(expect.any(String));
    });

    test("checkout sem internet guarda a visita e o momento da saída", async () => {
      semInternet();

      await expect(VisitaService.checkout("v1", {})).rejects.toMatchObject({
        enfileirado: true,
      });

      const [item] = await itensDaFila();
      expect(item).toMatchObject({ chave: "checkout:v1", tipo: "checkout" });
      expect(item.corpo.visitaId).toBe("v1");
    });

    test("a mensagem promete o que a fila cumpre, em vez de anunciar falha", async () => {
      semInternet();

      await expect(
        VisitaService.checkin({ hospitalId: "h1", origem: "GEOFENCE" })
      ).rejects.toThrow(/será enviado assim que a conexão voltar/);
    });

    test("falha de servidor não enfileira: aí existe o que repetir agora", async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError("Network request failed"));

      await expect(
        VisitaService.checkin({ hospitalId: "h1", origem: "GEOFENCE" })
      ).rejects.not.toMatchObject({ enfileirado: true });

      expect(await itensDaFila()).toHaveLength(0);
    });

    test("o reenvio leva o `ocorridoEm`, para a visita não registrar a hora da reconexão", async () => {
      const ocorridoEm = "2026-09-03T10:15:00.000Z";

      await VisitaService.enviarEventoOffline({
        tipo: "checkin",
        corpo: { hospitalId: "h1", origem: "GEOFENCE" },
        ocorridoEm,
      });

      expect(JSON.parse(chamadas[0].body).ocorridoEm).toBe(ocorridoEm);
    });

    test("o reenvio do checkout endereça a visita guardada", async () => {
      await VisitaService.enviarEventoOffline({
        tipo: "checkout",
        corpo: { visitaId: "v9", gpsIndisponivel: true },
        ocorridoEm: "2026-09-03T10:15:00.000Z",
      });

      expect(chamadas[0].url).toContain("/api/v1/visitas/v9/checkout");
      const corpo = JSON.parse(chamadas[0].body);
      expect(corpo.visitaId).toBeUndefined();
      expect(corpo.gpsIndisponivel).toBe(true);
    });
  });

  test("erro de conflito 409 preserva status/corpo (dedupe geofence, E2-04)", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ message: "Mais de um hospital nesta localização.", candidatos: [{ hospitalId: "h1" }] }, 409)
    );
    try {
      await VisitaService.checkin({ hospitalId: "h1", origem: "MANUAL" });
    } catch (e) {
      expect(e.status).toBe(409);
      expect(e.data.candidatos).toHaveLength(1);
      return;
    }
    throw new Error("deveria lançar erro");
  });
});
