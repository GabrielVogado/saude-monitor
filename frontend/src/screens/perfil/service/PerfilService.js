import { Platform } from "react-native";
import * as Location from "expo-location";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { buildApiUrl } from "../../../config/api";

import { fetchComRetry, fetchComTimeout } from "../../../config/http";
import { geracaoDaSessao, renovarSessao } from "../../../config/sessao";
import TokenStorage from "../../../services/TokenStorage";
import LoginService from "../../auth/service/LoginService";

/**
 * O PDF de exportação LGPD é montado sob demanda no servidor, então recebe
 * folga maior que o teto padrão de 20 s — mas ainda finita.
 */
const TIMEOUT_EXPORTACAO_MS = 60000;

const EXPORT_PDF_PATH = "/api/v1/contas/export/pdf";

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
    return fetchComRetry(buildApiUrl(path), {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  };

  // Geração lida antes do 401: se ela mudar, outra requisição já renovou a
  // sessão e esta só precisa repetir a chamada com o token novo.
  const geracao = geracaoDaSessao();
  let response = await doFetch();

  if (response.status === 401 && (await TokenStorage.getRefreshToken())) {
    try {
      await renovarSessao(() => LoginService.refresh(), geracao);
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
 * Faz o download autenticado do PDF no cache do app, renovando o token uma única
 * vez quando o backend responde 401 — mesmo contrato do `request()` dos demais
 * serviços, que não pode ser reaproveitado aqui por se tratar de binário.
 */
async function baixarComToken(nomeArquivo, token) {
  const geracao = geracaoDaSessao();
  const url = buildApiUrl(EXPORT_PDF_PATH);
  const destino = new File(Paths.cache, nomeArquivo);

  const baixar = (accessToken) =>
    File.downloadFileAsync(url, destino, {
      headers: { Authorization: `Bearer ${accessToken}` },
      idempotent: true,
    });

  try {
    return await baixar(token);
  } catch (erro) {
    // O módulo nativo só expõe o status na mensagem ("response has status: 401").
    if (!`${erro?.message}`.includes("401")) {
      throw new Error(erro?.message || "Não foi possível gerar o PDF dos seus dados.");
    }
  }

  try {
    await renovarSessao(() => LoginService.refresh(), geracao);
  } catch {
    await LoginService.logout();
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  return baixar(await TokenStorage.getAccessToken());
}

/** Fallback web: baixa o PDF como blob e delega o salvamento ao navegador. */
async function baixarNoNavegador(nomeArquivo, token) {
  // Sem retry de propósito (OPS-05): o teto desta chamada já é de 60 s, e uma
  // repetição por timeout dobraria a espera de quem está com a tela aberta
  // olhando. A tela oferece o botão de tentar de novo — aqui quem decide é o
  // usuário, não o cliente HTTP.
  const resposta = await fetchComTimeout(
    buildApiUrl(EXPORT_PDF_PATH),
    { headers: { Authorization: `Bearer ${token}` } },
    TIMEOUT_EXPORTACAO_MS
  );

  if (!resposta.ok) {
    throw new Error(
      resposta.status === 401
        ? "Sessão expirada. Faça login novamente."
        : `Não foi possível gerar o PDF dos seus dados (HTTP ${resposta.status}).`
    );
  }

  const uri = URL.createObjectURL(await resposta.blob());
  const link = document.createElement("a");
  link.href = uri;
  link.download = nomeArquivo;
  link.click();

  return { uri, nomeArquivo, compartilhado: true };
}

/**
 * Serviço da tela Perfil → Dados e Privacidade (Épico 05).
 *
 * Concentra o estado da sessão (usuário autenticado) e a gestão da permissão
 * de localização no nível do dispositivo, usada pelas telas de geolocalização.
 *
 * Alinhado aos critérios de aceite:
 * - E5-01: permissão de localização pode ser revogada em Perfil → Dados e Privacidade.
 * - E5-03: exportação dos dados pessoais em PDF (art. 18 da LGPD).
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
   * Baixa o relatório de dados pessoais em PDF (E5-03 / art. 18 da LGPD).
   *
   * O backend (`GET /api/v1/contas/export/pdf`) já devolve o documento pronto — o
   * app apenas persiste o arquivo e abre o menu de compartilhamento, para que o
   * cidadão salve, imprima ou envie o relatório sem precisar de ferramenta técnica.
   *
   * @returns {Promise<{ uri: string, nomeArquivo: string, compartilhado: boolean }>}
   */
  static async exportarDadosPdf() {
    const token = await TokenStorage.getAccessToken();
    if (!token) {
      throw new Error("Faça login para exportar seus dados.");
    }

    const nomeArquivo = `meus-dados-${new Date().toISOString().slice(0, 10)}.pdf`;

    // Em `web` não há sistema de arquivos nativo: o download é do navegador.
    if (Platform.OS === "web") {
      return baixarNoNavegador(nomeArquivo, token);
    }

    const arquivo = await baixarComToken(nomeArquivo, token);

    // `isAvailableAsync` é false em ambientes sem app capaz de abrir PDF: o
    // arquivo continua salvo no cache e a tela informa o caminho ao usuário.
    const podeCompartilhar = await Sharing.isAvailableAsync();
    if (podeCompartilhar) {
      await Sharing.shareAsync(arquivo.uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: "Meus dados pessoais",
      });
    }

    return { uri: arquivo.uri, nomeArquivo, compartilhado: podeCompartilhar };
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
