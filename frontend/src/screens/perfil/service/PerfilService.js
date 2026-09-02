import * as Location from "expo-location";
import { buildApiUrl } from "../../../config/api";
import TokenStorage from "../../../services/TokenStorage";
import LoginService from "../../auth/service/LoginService";

const CONSENTIMENTOS_PATH = "/api/v1/contas/consentimentos";

/** Versão vigente do aviso de privacidade exibido ao titular (E5-02). */
const VERSAO_TERMOS = "1.0";

/**
 * Chamada autenticada em JSON com renovação de token (401 → refresh → retry único),
 * no mesmo contrato de erro dos demais serviços (`VisitaService`, `HospitalService`).
 */
async function request(path, { method = "GET", body } = {}) {
  const doFetch = async () => {
    const token = await TokenStorage.getAccessToken();
    return fetch(buildApiUrl(path), {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  };

  let response = await doFetch();

  if (response.status === 401 && (await TokenStorage.getRefreshToken())) {
    try {
      await LoginService.refresh();
      response = await doFetch();
    } catch {
      await LoginService.logout();
      throw new Error("Sessão expirada. Faça login novamente.");
    }
  }

  const raw = await response.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const erro = new Error(
      data?.message || data?.error || `Falha na requisição (HTTP ${response.status}).`
    );
    erro.status = response.status;
    erro.data = data;
    throw erro;
  }

  return data;
}

/**
 * Serviço da tela Perfil → Dados e Privacidade (Épico 05).
 *
 * Concentra o estado da sessão (usuário autenticado) e a gestão da permissão
 * de localização no nível do dispositivo, usada pelas telas de geolocalização.
 *
 * Alinhado aos critérios de aceite:
 * - E5-01: permissão de localização pode ser revogada em Perfil → Dados e Privacidade.
 * - E5-05: a decisão sobre cada finalidade é auditada no backend
 *   (`PUT /api/v1/contas/consentimentos`).
 * - E5-04: conta (cadastro/login) é opcional; o Perfil orienta Login/Cadastro quando
 *   não há usuário autenticado.
 */
class PerfilService {
  /** Retorna o usuário autenticado persistido (ou null se não houver sessão). */
  static async usuarioLogado() {
    return TokenStorage.getUsuario();
  }

  /** Retorna o status atual da permissão de localização no dispositivo. */
  static async permissaoLocalizacao() {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status; // "granted" | "denied" | "undetermined"
  }

  /** Solicita a permissão de localização (E5-01 — pedido com explicação prévia). */
  static async solicitarPermissaoLocalizacao() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status;
  }

  /**
   * Registra a concessão/revogação de consentimento no backend (E5-05 / art. 8º §5º
   * da LGPD), gerando a trilha de auditoria da decisão do titular.
   *
   * Envia apenas as finalidades informadas. Como a conta é opcional (E5-04), sem
   * sessão ativa não há o que auditar: devolve `null` em vez de falhar — a permissão
   * do sistema operacional continua sendo a fonte de verdade no dispositivo.
   *
   * @param {{ localizacao?: boolean, notificacoes?: boolean }} finalidades
   * @returns {Promise<object|null>} estado gravado dos consentimentos, ou null sem sessão
   */
  static async atualizarConsentimento(finalidades) {
    if (!(await TokenStorage.getAccessToken())) {
      return null;
    }

    const corpo = { versaoTermos: VERSAO_TERMOS };
    if (typeof finalidades?.localizacao === "boolean") {
      corpo.localizacao = finalidades.localizacao;
    }
    if (typeof finalidades?.notificacoes === "boolean") {
      corpo.notificacoes = finalidades.notificacoes;
    }

    if (corpo.localizacao === undefined && corpo.notificacoes === undefined) {
      return null;
    }

    return request(CONSENTIMENTOS_PATH, { method: "PUT", body: corpo });
  }

  /** Desloga a sessão local (usado ao sair do Perfil). */
  static async deslogar() {
    await TokenStorage.limparTokens();
  }
}

export default PerfilService;
