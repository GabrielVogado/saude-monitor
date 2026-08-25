import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Persistência dos tokens JWT no cliente (Épico 01).
 *
 * Alinhado ao contrato `POST /api/v1/auth/login` (Especificacao-API-v2.0 §3.1),
 * que retorna `{ accessToken, refreshToken, expiraEm, usuario }`.
 *
 * Usa AsyncStorage por ser multiplataforma (Android/iOS/Web). TODO (pré-produção):
 * migrar para `expo-secure-store` no nativo, conforme §2.2 (token JWT apenas no
 * SecureStore do cliente), mantendo fallback em `localStorage` no Web.
 */

const ACCESS_TOKEN_KEY = "@saude_monitor:accessToken";
const REFRESH_TOKEN_KEY = "@saude_monitor:refreshToken";
const USUARIO_KEY = "@saude_monitor:usuario";

class TokenStorage {
  /** Grava access + refresh tokens e, opcionalmente, o usuário autenticado. */
  static async salvarTokens({ accessToken, refreshToken, usuario }) {
    const pares = [
      [ACCESS_TOKEN_KEY, accessToken ?? ""],
      [REFRESH_TOKEN_KEY, refreshToken ?? ""],
    ];

    await AsyncStorage.multiSet(pares);

    if (usuario) {
      await AsyncStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
    }
  }

  /** Retorna o access token JWT (ou null se não houver sessão). */
  static async getAccessToken() {
    const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    return token || null;
  }

  /** Retorna o refresh token JWT (ou null se não houver sessão). */
  static async getRefreshToken() {
    const token = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    return token || null;
  }

  /** Retorna o usuário autenticado persistido (ou null). */
  static async getUsuario() {
    const raw = await AsyncStorage.getItem(USUARIO_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /** Retorna true se o usuário persistido tem papel ADMIN (gating de UI). */
  static async isAdmin() {
    const usuario = await this.getUsuario();
    return usuario?.papel === "ADMIN";
  }

  /** Remove os tokens e o usuário persistidos (logout). */
  static async limparTokens() {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USUARIO_KEY]);
  }
}

export default TokenStorage;
