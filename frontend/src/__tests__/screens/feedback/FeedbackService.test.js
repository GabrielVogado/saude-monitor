/**
 * Feedback pós-saída (Épico 03) — FeedbackService.
 * Contrato §3.4: POST /api/v1/feedbacks (🔓 anônimo), GET /api/v1/visitas/{id}/feedback
 * e PUT /api/v1/feedbacks/{id}; dedupe único por visita (RN-12).
 */
import FeedbackService from "../../../screens/feedback/service/FeedbackService";
import TokenStorage from "../../../services/TokenStorage";

process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";

function jsonResponse(body, status = 200) {
  return { ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body };
}

describe("FeedbackService (Épico 03)", () => {
  let chamadas;
  beforeEach(async () => {
    require("@react-native-async-storage/async-storage").default.__reset();
    jest.clearAllMocks();
    chamadas = [];
    global.fetch = jest.fn().mockImplementation(async (url, config) => {
      chamadas.push({ url, method: config?.method || "GET", headers: config?.headers, body: config?.body });
      return jsonResponse({ id: "fb1", criadoEm: "2026-01-01T00:00:00Z", recebido: true }, 201);
    });
  });

  test("enviar faz POST anônimo em /api/v1/feedbacks (RN-20) sem Authorization", async () => {
    const payload = { visitaId: "v1", nota: 4, foiAtendido: "SIM" };
    const resp = await FeedbackService.enviar(payload);
    const c = chamadas[0];
    expect(c.method).toBe("POST");
    expect(c.url).toContain("/api/v1/feedbacks");
    expect(c.url).not.toContain("/visitas/");
    expect(JSON.parse(c.body).nota).toBe(4);
    expect(c.headers.Authorization).toBeUndefined();
    expect(resp.recebido).toBe(true);
  });

  test("enviar anexa Authorization quando há sessão (vincula ao usuário, RN-13)", async () => {
    await TokenStorage.salvarTokens({ accessToken: "TOK", refreshToken: "R" });
    await FeedbackService.enviar({ visitaId: "v1", nota: 5 });
    expect(chamadas[0].headers.Authorization).toBe("Bearer TOK");
  });

  test("buscarPorVisita faz GET em /api/v1/visitas/{id}/feedback", async () => {
    await FeedbackService.buscarPorVisita("v1");
    const c = chamadas[0];
    expect(c.method).toBe("GET");
    expect(c.url).toContain("/api/v1/visitas/v1/feedback");
  });

  test("atualizar faz PUT em /api/v1/feedbacks/{id} (janela 24h, RN-09)", async () => {
    await FeedbackService.atualizar("fb1", { visitaId: "v1", nota: 3 });
    const c = chamadas[0];
    expect(c.method).toBe("PUT");
    expect(c.url).toContain("/api/v1/feedbacks/fb1");
  });

  test("listarHistorico faz GET em /api/v1/contas/feedbacks com paginação", async () => {
    await FeedbackService.listarHistorico({ page: 1, size: 10 });
    const c = chamadas[0];
    expect(c.method).toBe("GET");
    expect(c.url).toContain("/api/v1/contas/feedbacks");
    expect(c.url).toContain("page=1");
    expect(c.url).toContain("size=10");
  });

  test("duplicidade (dedupe RN-12) — 409 propagado com status", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ message: "Você já avaliou esta visita." }, 409)
    );
    try {
      await FeedbackService.enviar({ visitaId: "v1", nota: 4 });
    } catch (e) {
      expect(e.status).toBe(409);
      expect(e.message).toContain("já avaliou");
      return;
    }
    throw new Error("deveria lançar conflito");
  });
});
