import { ErroSemInternet } from "../config/http";
import { itensDaFila, marcarTentativa, removerDaFila } from "../config/filaOffline";
import VisitaService from "../screens/visitas/service/VisitaService";

/**
 * Envia o que ficou na fila offline (OPS-05).
 *
 * A fila (`config/filaOffline.js`) apenas guarda; este módulo é quem sabe falar
 * com a API. A separação evita que o armazenamento dependa de serviço, e é o que
 * permite a fila ser testada sem rede.
 *
 * Roda quando o app volta ao primeiro plano e quando a conexão retorna — os dois
 * momentos em que vale a pena tentar de novo.
 */

/**
 * Tentativas antes de desistir de um item. Não é uma medida de paciência e sim
 * de sanidade: um evento que falha cinco vezes seguidas por motivo diferente de
 * conectividade não vai passar na sexta, e mantê-lo faz a fila travar atrás dele.
 */
export const MAX_TENTATIVAS = 5;

// Trava simples de reentrada. `sincronizar` é disparada por dois gatilhos que
// podem coincidir (voltar ao primeiro plano com a conexão retornando junto);
// sem isso, o mesmo item seria enviado duas vezes em paralelo.
let emAndamento = false;

/**
 * Um erro de cliente (4xx) significa que o servidor entendeu e recusou — o item
 * não melhora com o tempo. O caso concreto é o 409 de checkout de visita que já
 * foi encerrada pelo job de expiração enquanto o aparelho estava offline: o fato
 * já está registrado no servidor, insistir só devolveria o mesmo 409 para sempre.
 */
function recusaDefinitiva(erro) {
  return Number.isInteger(erro?.status) && erro.status >= 400 && erro.status < 500;
}

export async function sincronizar() {
  if (emAndamento) {
    return { enviados: 0, descartados: 0, pendentes: null, ignorado: true };
  }

  emAndamento = true;
  let enviados = 0;
  let descartados = 0;

  try {
    const itens = await itensDaFila();

    for (const item of itens) {
      try {
        await VisitaService.enviarEventoOffline(item);
        await removerDaFila(item.chave);
        enviados += 1;
      } catch (erro) {
        if (erro instanceof ErroSemInternet) {
          // Continua offline: parar aqui preserva a ordem dos eventos e evita
          // gastar tentativa de todos os itens numa rodada que não vai passar.
          break;
        }

        if (recusaDefinitiva(erro) || (item.tentativas || 0) + 1 >= MAX_TENTATIVAS) {
          await removerDaFila(item.chave);
          descartados += 1;
        } else {
          await marcarTentativa(item.chave);
        }
      }
    }
  } finally {
    emAndamento = false;
  }

  const pendentes = (await itensDaFila()).length;

  return { enviados, descartados, pendentes, ignorado: false };
}

export default { sincronizar, MAX_TENTATIVAS };
