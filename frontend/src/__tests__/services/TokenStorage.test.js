/**
 * Persistência de tokens JWT (Fase 0) — salvar/ler/limpar sessão no dispositivo.
 * Fonte: Especificacao-API-v2.0 §3.1 (login retorna accessToken/refreshToken/usuario).
 * ARQ-02: no nativo os tokens ficam no `expo-secure-store`, não no AsyncStorage.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import TokenStorage from "../../services/TokenStorage";

const CHAVE_ACCESS_LEGADA = "@saude_monitor:accessToken";
const CHAVE_REFRESH_LEGADA = "@saude_monitor:refreshToken";
const CHAVE_ACCESS_SEGURA = "saude_monitor.accessToken";

describe("services/TokenStorage", () => {
  beforeEach(async () => {
    // limpa o armazenamento em memória dos mocks
    const mod = require("@react-native-async-storage/async-storage");
    mod.default.__reset();
    SecureStore.__reset();
    jest.clearAllMocks();
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

  test("ARQ-02: tokens vão para o SecureStore, e não para o AsyncStorage", async () => {
    await TokenStorage.salvarTokens({ accessToken: "AAA", refreshToken: "RRR" });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(CHAVE_ACCESS_SEGURA, "AAA");
    expect(await AsyncStorage.getItem(CHAVE_ACCESS_LEGADA)).toBeNull();
    expect(await AsyncStorage.getItem(CHAVE_REFRESH_LEGADA)).toBeNull();
  });

  test("o usuário continua no AsyncStorage — é cache de perfil, não credencial", async () => {
    await TokenStorage.salvarTokens({
      accessToken: "A",
      refreshToken: "R",
      usuario: { id: "u1", nome: "Ana" },
    });

    expect(await AsyncStorage.getItem("@saude_monitor:usuario")).toContain("Ana");
  });

  test("migra a sessão que estava no AsyncStorage sem deslogar o usuário", async () => {
    // Estado de quem já tinha sessão antes desta versão do app.
    await AsyncStorage.setItem(CHAVE_ACCESS_LEGADA, "TOKEN_ANTIGO");
    await AsyncStorage.setItem(CHAVE_REFRESH_LEGADA, "REFRESH_ANTIGO");

    expect(await TokenStorage.getAccessToken()).toBe("TOKEN_ANTIGO");
    expect(await TokenStorage.getRefreshToken()).toBe("REFRESH_ANTIGO");

    // Depois de migrado, o token some do armazenamento não criptografado.
    expect(await AsyncStorage.getItem(CHAVE_ACCESS_LEGADA)).toBeNull();
    expect(await SecureStore.getItemAsync(CHAVE_ACCESS_SEGURA)).toBe("TOKEN_ANTIGO");
  });

  test("a migração só ocorre uma vez: a segunda leitura já vem do SecureStore", async () => {
    await AsyncStorage.setItem(CHAVE_ACCESS_LEGADA, "TOKEN_ANTIGO");

    await TokenStorage.getAccessToken();
    await TokenStorage.getAccessToken();

    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  test("limparTokens apaga também o resíduo legado do AsyncStorage", async () => {
    await AsyncStorage.setItem(CHAVE_ACCESS_LEGADA, "TOKEN_ANTIGO");
    await AsyncStorage.setItem(CHAVE_REFRESH_LEGADA, "REFRESH_ANTIGO");

    await TokenStorage.limparTokens();

    expect(await AsyncStorage.getItem(CHAVE_ACCESS_LEGADA)).toBeNull();
    expect(await AsyncStorage.getItem(CHAVE_REFRESH_LEGADA)).toBeNull();
  });

  test("salvar token vazio apaga o valor guardado, em vez de gravar string vazia", async () => {
    await TokenStorage.salvarTokens({ accessToken: "A", refreshToken: "R" });
    await TokenStorage.salvarTokens({ accessToken: undefined, refreshToken: undefined });

    expect(await TokenStorage.getAccessToken()).toBeNull();
    expect(await TokenStorage.getRefreshToken()).toBeNull();
  });
});
