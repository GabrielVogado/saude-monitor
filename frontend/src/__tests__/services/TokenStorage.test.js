/**
 * Persistência de tokens JWT (Fase 0) — salvar/ler/limpar sessão no dispositivo.
 * Fonte: Especificacao-API-v2.0 §3.1 (login retorna accessToken/refreshToken/usuario).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import TokenStorage from "../../services/TokenStorage";

describe("services/TokenStorage", () => {
  beforeEach(async () => {
    // limpa o armazenamento em memória do mock
    const mod = require("@react-native-async-storage/async-storage");
    mod.default.__reset();
  });

  test("salvarTokens persiste access/refresh e usuário", async () => {
    await TokenStorage.salvarTokens({
      accessToken: "AAA",
      refreshToken: "RRR",
      usuario: { id: "u1", nome: "Ana", papel: "USUARIO" },
    });
    expect(await TokenStorage.getAccessToken()).toBe("AAA");
    expect(await TokenStorage.getRefreshToken()).toBe("RRR");
    expect(await TokenStorage.getUsuario()).toEqual({ id: "u1", nome: "Ana", papel: "USUARIO" });
  });

  test("getUsuario retorna null quando não há sessão", async () => {
    expect(await TokenStorage.getUsuario()).toBeNull();
    expect(await TokenStorage.getAccessToken()).toBeNull();
  });

  test("USUARIO não é gravado quando ausente", async () => {
    await TokenStorage.salvarTokens({ accessToken: "A", refreshToken: "R" });
    expect(await TokenStorage.getUsuario()).toBeNull();
  });

  test("limparTokens remove toda a sessão", async () => {
    await TokenStorage.salvarTokens({
      accessToken: "A",
      refreshToken: "R",
      usuario: { id: "u1" },
    });
    await TokenStorage.limparTokens();
    expect(await TokenStorage.getAccessToken()).toBeNull();
    expect(await TokenStorage.getRefreshToken()).toBeNull();
    expect(await TokenStorage.getUsuario()).toBeNull();
  });
});
