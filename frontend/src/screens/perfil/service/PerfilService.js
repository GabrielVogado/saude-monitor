import * as Location from "expo-location";
import TokenStorage from "../../../services/TokenStorage";

/**
 * Serviço da tela Perfil → Dados e Privacidade (Épico 05).
 *
 * Concentra o estado da sessão (usuário autenticado) e a gestão da permissão
 * de localização no nível do dispositivo, usada pelas telas de geolocalização.
 *
 * Alinhado aos critérios de aceite:
 * - E5-01: permissão de localização pode ser revogada em Perfil → Dados e Privacidade.
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

  /** Desloga a sessão local (usado ao sair do Perfil). */
  static async deslogar() {
    await TokenStorage.limparTokens();
  }
}

export default PerfilService;
