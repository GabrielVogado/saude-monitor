import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/**
 * Persistência dos tokens JWT no cliente (Épico 01).
 *
 * Alinhado ao contrato `POST /api/v1/auth/login` (Especificacao-API-v2.0 §3.1),
 * que retorna `{ accessToken, refreshToken, expiraEm, usuario }`.
 *
 * No nativo (Android/iOS) os **tokens** ficam no `expo-secure-store`, que usa o
 * Keychain no iOS e o EncryptedSharedPreferences no Android — atende à §2.2
 * ("token JWT apenas no SecureStore do cliente") e ao ARQ-02. No Web o
 * SecureStore não existe, e o AsyncStorage (`localStorage`) permanece.
 *
 * O **usuário autenticado** continua no AsyncStorage nas duas plataformas: não é
 * credencial, é cache de perfil recuperável por `GET /contas/perfil`, e é o
 * único valor que poderia esbarrar no limite de 2 KB por item do Keychain.
 */

/** Chaves usadas até a migração; ainda lidas para não deslogar quem atualizar. */
const CHAVE_ACCESS_LEGADA = "@saude_monitor:accessToken";
const CHAVE_REFRESH_LEGADA = "@saude_monitor:refreshToken";

/** O SecureStore só aceita `[A-Za-z0-9._-]` em chaves — daí o formato novo. */
const CHAVE_ACCESS_SEGURA = "saude_monitor.accessToken";
const CHAVE_REFRESH_SEGURA = "saude_monitor.refreshToken";

const CHAVE_USUARIO = "@saude_monitor:usuario";

const usaSecureStore = Platform.OS !== "web";

const CHAVE_ACCESS = usaSecureStore ? CHAVE_ACCESS_SEGURA : CHAVE_ACCESS_LEGADA;
const CHAVE_REFRESH = usaSecureStore ? CHAVE_REFRESH_SEGURA : CHAVE_REFRESH_LEGADA;

/** Chave antiga correspondente a cada chave nova, para a migração silenciosa. */
const EQUIVALENTE_LEGADA = {
  [CHAVE_ACCESS_SEGURA]: CHAVE_ACCESS_LEGADA,
  [CHAVE_REFRESH_SEGURA]: CHAVE_REFRESH_LEGADA,
};

/**
 * Move um token que ficou no AsyncStorage de versões anteriores. Sem isso, a
 * atualização do app deslogaria todo mundo que já tinha sessão ativa.
 */
async function migrarTokenLegado(chave) {
  const legada = EQUIVALENTE_LEGADA[chave];
  if (!legada) return null;

  const valor = await AsyncStorage.getItem(legada);
  if (!valor) return null;

  await SecureStore.setItemAsync(chave, valor);
  await AsyncStorage.removeItem(legada);

  return valor;
}

async function gravarToken(chave, valor) {
  if (!usaSecureStore) {
    await AsyncStorage.setItem(chave, valor ?? "");
    return;
  }

  // O SecureStore não guarda string vazia como "ausente": apagar é explícito.
  if (valor) {
    await SecureStore.setItemAsync(chave, valor);
  } else {
    await SecureStore.deleteItemAsync(chave);
  }
}

async function lerToken(chave) {
  if (!usaSecureStore) {
    return (await AsyncStorage.getItem(chave)) || null;
  }

  const valor = await SecureStore.getItemAsync(chave);
  if (valor) return valor;

  return (await migrarTokenLegado(chave)) || null;
}

async function apagarToken(chave) {
  if (usaSecureStore) {
    await SecureStore.deleteItemAsync(chave);
  }

  // Também limpa o resíduo legado de quem nunca chegou a ler o token migrado.
  await AsyncStorage.removeItem(EQUIVALENTE_LEGADA[chave] ?? chave);
}

class TokenStorage {
  /** Grava access + refresh tokens e, opcionalmente, o usuário autenticado. */
  static async salvarTokens({ accessToken, refreshToken, usuario }) {
    await gravarToken(CHAVE_ACCESS, accessToken);
    await gravarToken(CHAVE_REFRESH, refreshToken);

    if (usuario) {
      await AsyncStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
    }
  }

  /** Retorna o access token JWT (ou null se não houver sessão). */
  static async getAccessToken() {
    return lerToken(CHAVE_ACCESS);
  }

  /** Retorna o refresh token JWT (ou null se não houver sessão). */
  static async getRefreshToken() {
    return lerToken(CHAVE_REFRESH);
  }

  /** Retorna o usuário autenticado persistido (ou null). */
  static async getUsuario() {
    const raw = await AsyncStorage.getItem(CHAVE_USUARIO);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /** Remove os tokens e o usuário persistidos (logout). */
  static async limparTokens() {
    await apagarToken(CHAVE_ACCESS);
    await apagarToken(CHAVE_REFRESH);
    await AsyncStorage.removeItem(CHAVE_USUARIO);
  }
}

export default TokenStorage;
