import Constants from "expo-constants";
import { apiRequest } from "../core/api/apiClient";

/**
 * Configuração remota da operação (APP-03, ARQ-09): versão mínima do app, modo somente
 * leitura e mensagem de manutenção, lidas de `GET /api/v1/configuracao`.
 *
 * Sem ela, uma correção de escala ou de segurança dependia de cada pessoa atualizar o app
 * por conta própria, e as versões antigas seguiam gerando o tráfego antigo por meses.
 */

const CAMINHO = "/api/v1/configuracao";

/** Pacote do app na Play Store, quando o build não informa outro. */
const PACOTE_PADRAO = "com.gabrielvogado.saudemonitor";

/** Versão instalada (ex.: `1.0.0`), a do `app.json` embutida no build. */
export function versaoDoApp() {
  return Constants.expoConfig?.version || null;
}

/** Lê `1.2.3` (com ou sem sufixo, como `-rc.5`) como três números, ou `null` se não der. */
function partes(versao) {
  const casamento = /^(\d+)\.(\d+)\.(\d+)/.exec(String(versao || "").trim());
  return casamento ? casamento.slice(1).map(Number) : null;
}

/**
 * Compara duas versões pelos três números. Sufixo de pré-lançamento não conta: uma
 * `1.0.0-rc.5` de homologação vale como `1.0.0`.
 *
 * @returns negativo se `a < b`, zero se iguais, positivo se `a > b`; `null` se alguma
 *   não puder ser lida.
 */
export function compararVersoes(a, b) {
  const pa = partes(a);
  const pb = partes(b);
  if (!pa || !pb) {
    return null;
  }
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) {
      return pa[i] - pb[i];
    }
  }
  return 0;
}

/**
 * O app instalado está abaixo da versão mínima. Na dúvida (sem mínima, versão ilegível),
 * não bloqueia: impedir o uso por um dado ruim seria pior do que deixar passar.
 */
export function precisaAtualizar(configuracao, versaoInstalada = versaoDoApp()) {
  const minima = configuracao?.versaoMinimaApp;
  if (!minima) {
    return false;
  }
  const comparacao = compararVersoes(versaoInstalada, minima);
  return comparacao !== null && comparacao < 0;
}

/** Endereços da página do app na loja: o do app da Play Store e o da web, nessa ordem. */
export function enderecosDaLoja() {
  const pacote = Constants.expoConfig?.android?.package || PACOTE_PADRAO;
  return [
    `market://details?id=${pacote}`,
    `https://play.google.com/store/apps/details?id=${pacote}`,
  ];
}

class ConfiguracaoRemota {
  /** Configuração em vigor; falha de rede chega a quem chamou. */
  static obter() {
    return apiRequest(CAMINHO);
  }
}

export default ConfiguracaoRemota;
