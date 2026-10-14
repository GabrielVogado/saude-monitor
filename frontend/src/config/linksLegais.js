import { Linking } from "react-native";

/**
 * Endereços públicos dos textos legais (site em `site/` na raiz do repositório,
 * publicado em saudemonitor.dev). A Play Store exige a política num endereço público;
 * o app abre as mesmas páginas para o texto completo não divergir do publicado.
 */
export const URL_POLITICA_PRIVACIDADE = "https://saudemonitor.dev/privacidade";
export const URL_TERMOS_USO = "https://saudemonitor.dev/termos";
export const URL_EXCLUSAO_CONTA = "https://saudemonitor.dev/exclusao-de-conta";
export const EMAIL_PRIVACIDADE = "privacidade@saudemonitor.dev";

/** Versão dos Termos e da Política aceita no cadastro (UserScreen). */
export const VERSAO_TERMOS = "1.0";

/**
 * Abre um texto legal publicado no navegador. Sem app capaz de abrir o link, nada
 * quebra: o resumo da política continua em Perfil → Privacidade.
 */
export function abrirLinkLegal(url) {
  return Linking.openURL(url).catch(() => false);
}
