import { buildApiUrl } from "../../../config/api";
import TokenStorage from "../../../services/TokenStorage";

const BASE_PATH = "/api/v1/auth";

/**
 * Cliente de autenticação alinhado ao contrato v2.0 (§3.1):
 * - `POST /api/v1/auth/login` → `{ accessToken, refreshToken, expiraEm, usuario }`
 * - `POST /api/v1/auth/refresh` → rotaciona o par de tokens
 * - `POST /api/v1/auth/logout` → revoga o refresh token no servidor (blacklist)
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

  /**
   * Encerra a sessão (§3.1): revoga o refresh token no servidor (best-effort) e limpa
   * os tokens persistidos no dispositivo.
   *
   * A revogação server-side é best-effort de propósito — o logout local nunca fica
   * bloqueado por falha de rede/backend (o interceptor 401 também chama este método).
   */
  static async logout() {
    const refreshToken = await TokenStorage.getRefreshToken();

    if (refreshToken) {
      try {
        await post(`${BASE_PATH}/logout`, { refreshToken });
      } catch {
        // ignora: sem conexão o refresh expira sozinho; o logout local segue.
      }
    }

    await TokenStorage.limparTokens();
  }

  /**
   * Exclui a conta do usuário autenticado (F0-05/LGPD).
   *
   * Envia `DELETE /api/v1/contas/exclusao` com o access token e, em caso de
   * sucesso, remove a sessão local (logout) já que a conta deixou de existir.
   */
  static async excluirConta() {
    const accessToken = await TokenStorage.getAccessToken();

    if (!accessToken) {
      throw new Error("Sessão expirada. Faça login novamente.");
    }

    const url = buildApiUrl("/api/v1/contas/exclusao");

    let response;
    try {
      response = await fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
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
        `Falha ao excluir a conta (HTTP ${response.status}).`;
      throw new Error(message);
    }

    await TokenStorage.limparTokens();
    return data;
  }
}

export default LoginService;
