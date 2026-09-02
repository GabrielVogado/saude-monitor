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
