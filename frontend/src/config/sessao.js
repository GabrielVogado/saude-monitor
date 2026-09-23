import { ErroDeConexao } from "./http";

/**
 * Coordenação da renovação do access token entre requisições concorrentes.
 *
 * O backend **rotaciona** o par de tokens a cada `POST /api/v1/auth/refresh` e
 * põe o refresh token usado numa blacklist (`AuthServiceImpl`). A consequência
 * prática é que dois refresh disparados com o mesmo token não são apenas
 * redundantes: o segundo **falha**, e o serviço que o disparou interpreta a
 * falha como sessão morta e chama `logout()`.
 *
 * O cenário não é raro. O access token dura 15 minutos e a Home carrega visita
 * ativa e hospitais em paralelo: quando o token vence, as duas requisições
 * recebem 401 no mesmo instante, as duas leem o mesmo refresh token e o usuário
 * é deslogado sem ter feito nada.
 *
 * Este módulo resolve as duas metades do problema:
 *
 * 1. **Renovação única em voo** — requisições que pedem renovação enquanto uma
 *    já está em curso aguardam a mesma promessa, em vez de abrir a sua.
 * 2. **Geração da sessão** — quem observou a sessão antes de uma renovação já
 *    concluída não precisa renovar de novo; basta repetir a requisição com o
 *    token novo. Sem isso, uma rajada de N requisições ainda produziria N
 *    rotações em sequência, cada uma invalidando o token da anterior.
 */

/** Promessa da renovação em curso, ou `null` quando não há nenhuma. */
let renovacaoEmCurso = null;

/** Contador incrementado a cada renovação bem-sucedida. */
let geracao = 0;

/**
 * Geração corrente da sessão. Deve ser lida **antes** de montar a requisição,
 * para que o 401 possa ser comparado com a sessão que o produziu.
 */
export function geracaoDaSessao() {
  return geracao;
}

/**
 * Renova a sessão no máximo uma vez por geração.
 *
 * @param {() => Promise<unknown>} executarRenovacao chamada que de fato renova
 *   (tipicamente `() => LoginService.refresh()`); recebida por parâmetro para
 *   não criar dependência circular entre este módulo e o serviço de login.
 * @param {number} [geracaoObservada] geração lida antes da requisição que tomou
 *   401. Quando ela ficou para trás, outra requisição já renovou e esta apenas
 *   precisa tentar de novo — nenhuma renovação é disparada.
 * @returns {Promise<unknown>} o resultado da renovação, ou `null` quando ela foi
 *   dispensada por já ter acontecido.
 */
export async function renovarSessao(executarRenovacao, geracaoObservada) {
  if (geracaoObservada !== undefined && geracaoObservada !== geracao) {
    return null;
  }

  if (!renovacaoEmCurso) {
    renovacaoEmCurso = (async () => {
      try {
        const resultado = await executarRenovacao();
        geracao += 1;
        return resultado;
      } finally {
        // Liberado no sucesso e no erro: uma renovação que falhou não pode
        // bloquear a próxima tentativa, feita depois de um novo login.
        renovacaoEmCurso = null;
      }
    })();
  }

  return renovacaoEmCurso;
}

/**
 * Descarta o estado de renovação. Existe para os testes, que precisam de um
 * módulo limpo entre casos, e para o encerramento de sessão.
 */
export function reiniciarControleDeRenovacao() {
  renovacaoEmCurso = null;
  geracao = 0;
}

/**
 * Decide se uma falha ao renovar a sessão deve encerrá-la (logout) ou não.
 *
 * Achado de 10/09/2026: os 5 pontos que chamam `renovarSessao` tratavam QUALQUER
 * falha do refresh como "sessão morta" — inclusive um 503 do backend em cold start
 * (medido ~14s nesta sessão) ou uma falha de rede passageira, que nada têm a ver com
 * o refresh token (válido por 30 dias) estar realmente inválido. O access token dura
 * só 15 minutos, então esse cenário é comum: o app fica ocioso, o backend "esfria"
 * junto, e a primeira tentativa de renovar ao reabrir o app cai exatamente nessa
 * janela — deslogando o usuário sem necessidade.
 *
 * Só desloga quando o SERVIDOR respondeu explicitamente que o token não vale mais
 * (401/403 do próprio endpoint `/auth/refresh`), ou quando não havia refresh token
 * armazenado para começar (erro local, síncrono, lançado por `LoginService.refresh`
 * antes de qualquer chamada de rede — cai no fallback abaixo, sem `.status` e sem
 * ser `ErroDeConexao`). Qualquer falha de transporte (sem internet, timeout,
 * servidor indisponível) ou outro status HTTP que não seja uma rejeição explícita do
 * token preserva a sessão local — a próxima tentativa usa o mesmo refresh token.
 */
export function deveEncerrarSessao(erro) {
  if (erro instanceof ErroDeConexao) {
    return false;
  }
  if (typeof erro?.status === "number") {
    return erro.status === 401 || erro.status === 403;
  }
  return true;
}
