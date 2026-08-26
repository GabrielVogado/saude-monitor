import { buildApiUrl } from "../../../config/api";
import TokenStorage from "../../../services/TokenStorage";

const BASE_PATH = "/api/v1/auth";

/**
 * Cliente de autenticação alinhado ao contrato v2.0 (§3.1):
 * - `POST /api/v1/auth/login` → `{ accessToken, refreshToken, expiraEm, usuario }`
 * - `POST /api/v1/auth/refresh` → rotaciona o par de tokens
 */
async function post(path, body) {
  const url = buildApiUrl(path);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error?.message === "Network request failed") {
      throw new Error(
        `Não foi possível conectar ao backend em ${url}. Verifique a API, a URL e a rede.`
      );
    }
    throw error;
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Falha na autenticação (HTTP ${response.status}).`;
    throw new Error(message);
  }

  return data;
}

class LoginService {
  /**
   * Autentica credenciais e persiste os tokens + usuário no dispositivo.
   *
   * @param {{ email: string, password: string, rememberDevice?: boolean }} credenciais
   * @returns {Promise<{ accessToken: string, refreshToken: string, expiraEm: number, usuario: object }>}
   */
  static async login({ email, password, rememberDevice }) {
    const payload = {
      email: email?.trim() || "",
      password: password || "",
      rememberDevice: Boolean(rememberDevice),
    };

    const response = await post(`${BASE_PATH}/login`, payload);

    if (response.usuario?.papel === "ADMIN") {
      throw new Error(
        "Acesso administrativo disponível apenas pelo Painel Administrativo Web. Utilize um usuário do aplicativo."
      );
    }

    await TokenStorage.salvarTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      usuario: response.usuario,
    });

    return response;
  }

  /**
   * Renova o access token a partir do refresh token persistido (rotação).
   * Reutilizado pelo interceptor 401 do HospitalService.
   */
  static async refresh() {
    const refreshToken = await TokenStorage.getRefreshToken();

    if (!refreshToken) {
      throw new Error("Sessão expirada. Faça login novamente.");
    }

    const response = await post(`${BASE_PATH}/refresh`, { refreshToken });

    await TokenStorage.salvarTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      usuario: response.usuario ?? (await TokenStorage.getUsuario()),
    });

    return response;
  }

  /** Remove a sessão persistida (logout local). */
  static async logout() {
    await TokenStorage.limparTokens();
  }
}

export default LoginService;
