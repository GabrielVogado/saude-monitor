/**
 * Configuração remota e versão mínima do app (APP-03).
 */
import Constants from "expo-constants";
import ConfiguracaoRemota, {
  compararVersoes,
  enderecosDaLoja,
  precisaAtualizar,
  versaoDoApp,
} from "../../services/ConfiguracaoRemota";
import { apiRequest } from "../../core/api/apiClient";

jest.mock("../../core/api/apiClient", () => ({
  __esModule: true,
  apiRequest: jest.fn(),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.0.0", android: { package: "com.exemplo.app" } } },
}));

describe("ConfiguracaoRemota", () => {
  test("lê a configuração do servidor", async () => {
    apiRequest.mockResolvedValue({ modoSomenteLeitura: false, versaoMinimaApp: "1.0.0" });

    await expect(ConfiguracaoRemota.obter()).resolves.toEqual({ modoSomenteLeitura: false, versaoMinimaApp: "1.0.0" });
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/configuracao");
  });

  test("compara versões pelos três números, ignorando o sufixo de homologação", () => {
    expect(compararVersoes("1.0.0", "1.0.1")).toBeLessThan(0);
    expect(compararVersoes("1.10.0", "1.9.9")).toBeGreaterThan(0);
    expect(compararVersoes("1.0.0-rc.5", "1.0.0")).toBe(0);
    expect(compararVersoes("x", "1.0.0")).toBeNull();
    expect(compararVersoes("1.0.0", undefined)).toBeNull();
  });

  test("pede atualização só abaixo da mínima", () => {
    expect(precisaAtualizar({ versaoMinimaApp: "1.1.0" }, "1.0.9")).toBe(true);
    expect(precisaAtualizar({ versaoMinimaApp: "1.1.0" }, "1.1.0")).toBe(false);
    expect(precisaAtualizar({ versaoMinimaApp: "1.1.0" }, "2.0.0")).toBe(false);
  });

  test("na dúvida não bloqueia", () => {
    expect(precisaAtualizar({ versaoMinimaApp: null }, "0.0.1")).toBe(false);
    expect(precisaAtualizar(null, "0.0.1")).toBe(false);
    expect(precisaAtualizar({ versaoMinimaApp: "1.0.0" }, null)).toBe(false);
  });

  test("usa a versão embutida no build", () => {
    expect(versaoDoApp()).toBe("1.0.0");
    expect(precisaAtualizar({ versaoMinimaApp: "1.0.1" })).toBe(true);
  });

  test("aponta para o app da loja e para a página web do pacote", () => {
    expect(enderecosDaLoja()).toEqual([
      "market://details?id=com.exemplo.app",
      "https://play.google.com/store/apps/details?id=com.exemplo.app",
    ]);
  });

  test("sem dados do build, cai no pacote padrão e sem versão", () => {
    const original = Constants.expoConfig;
    Constants.expoConfig = undefined;
    try {
      expect(versaoDoApp()).toBeNull();
      expect(enderecosDaLoja()[0]).toBe("market://details?id=com.gabrielvogado.saudemonitor");
    } finally {
      Constants.expoConfig = original;
    }
  });
});
