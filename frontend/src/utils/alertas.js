import { Alert } from "react-native";
import { ErroDeConexao } from "../config/http";

/**
 * Alerta para um evento enfileirado offline (OPS-05 — check-in/check-out sem
 * internet). O título nunca pode soar como falha: o evento foi guardado com
 * sucesso e será sincronizado assim que a conexão voltar.
 */
export function avisarSemConexao(mensagem) {
  Alert.alert("Sem conexão", mensagem);
}

/**
 * Aplica um erro de refetch a um estado local (visitaAtiva/visitaManual) sem
 * apagar dado bom por falta de conectividade: falha de rede não significa
 * "não há visita ativa", significa "não sabemos". Um erro real (sessão
 * expirada, 500) continua limpando o estado normalmente.
 *
 * LIMITAÇÃO CONHECIDA (achado de code-review, aceita por decisão do PO em
 * 08/09/2026 em vez de resolvida aqui): isto reduz, mas não elimina, a janela
 * de corrida do check-in/check-out enfileirado offline. Entre a conexão
 * voltar e a fila (`config/filaOffline.js`) de fato sincronizar o evento
 * pendente, um refoco da tela chama `buscarAtiva()` — que agora tem sucesso
 * (online) mas ainda reflete o estado ANTIGO do servidor — e sobrescreve o
 * estado local otimista com o que o backend ainda tem. Resolver por completo
 * exigiria o guard consultar a fila offline real como fonte de verdade, em
 * vez de estado local adivinhado — escopo maior, não implementado aqui.
 */
export function preservarSeSemConexao(erro, definirEstado) {
  if (!(erro instanceof ErroDeConexao)) {
    definirEstado(null);
  }
}
