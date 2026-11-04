import { ErroDeConexao } from "../config/http";
import { itensDaFila, marcarTentativa, removerDaFila, vincularSaidaPendente } from "../config/filaOffline";
import VisitaService from "../screens/visitas/service/VisitaService";
import { invalidarVisitaAtiva } from "../core/query/queryClient";

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

/**
 * Sem internet, sem resposta (timeout, servidor fora) ou 5xx: o servidor não decidiu nada, e
 * o item espera a próxima rodada sem gastar tentativa. Antes só a falta de internet era
 * poupada, e com sinal fraco cinco timeouts seguidos descartavam o checkout (teste de campo de
 * 23/10/2026). A validade de 24h da fila continua limitando a espera.
 */
function semDecisaoDoServidor(erro) {
  return erro instanceof ErroDeConexao || (Number.isInteger(erro?.status) && erro.status >= 500);
}

/**
 * Quem acompanha a visita no aparelho (o geofencing) precisa saber o que a fila resolveu
 * sobre uma entrada guardada sem internet (teste de campo de 29/10/2026). Sem isso, o
 * check-in chegava ao servidor e o aparelho nunca conhecia o número da visita: não mandava
 * sinal nem checkout, e o job a encerrava como GPS interrompido com 0 min. Um observador só,
 * trocado a cada registro, para o módulo carregado de novo pelo SO não acumular cópias.
 *
 * Eventos, com `chaveEntrada` = chave do check-in na fila:
 * `{ tipo: "entrada", chaveEntrada, hospitalId, visitaId, entrada, saidaPendente }`,
 * `{ tipo: "entradaRecusada", chaveEntrada, hospitalId }` e
 * `{ tipo: "saida", hospitalId, visitaId, duracaoMinutos }` (saída que esperava a entrada).
 */
let observador = null;

export function definirObservador(funcao) {
  observador = typeof funcao === "function" ? funcao : null;
}

async function avisar(evento) {
  try {
    await observador?.(evento);
  } catch {
    // Quem observa trata as próprias falhas; a fila segue.
  }
}

/** Entrada (`{ chave, hospitalId }`) que esta saída ainda espera, ou `null`. */
function entradaEsperada(item) {
  return item?.tipo === "checkout" && !item.corpo?.visitaId ? item.corpo?.entradaPendente || null : null;
}

/** Erro ao conferir a visita aberta: a saída não foi enviada, então não é recusa dela. */
class ErroAoConferirVisita extends Error {
  constructor(causa) {
    super(causa?.message);
    this.causa = causa;
  }
}

/**
 * Número da visita para a saída que esperava a entrada. Entrada aceita nesta rodada: o
 * número que o servidor devolveu. Recusada nesta rodada: nenhum. Se o check-in saiu numa
 * rodada anterior e o vínculo não foi gravado, vale a visita aberta da mesma unidade que
 * começou antes da saída; uma visita aberta depois (check-in manual após a recusa) não é dela.
 */
async function resolverVisitaDaSaida(item, entrada, rodada) {
  if (rodada.entregues[entrada.chave]) {
    return rodada.entregues[entrada.chave];
  }
  if (rodada.recusadas.has(entrada.chave)) {
    return null;
  }

  let visita;
  try {
    visita = (await VisitaService.buscarAtiva())?.visita;
  } catch (erro) {
    throw semDecisaoDoServidor(erro) ? erro : new ErroAoConferirVisita(erro);
  }
  const comecouAntes = !(new Date(visita?.entrada).getTime() > new Date(item.ocorridoEm).getTime());
  return visita?.hospitalId === entrada.hospitalId && comecouAntes ? visita.id : null;
}

/**
 * Envia um item e diz o que aconteceu com ele: `enviado`, `descartado`, `mantido` (gastou
 * tentativa) ou `parar` (o servidor não respondeu; a rodada para para preservar a ordem).
 */
async function processarItem(item, seguintes, rodada) {
  try {
    const entrada = entradaEsperada(item);
    let envio = item;
    if (entrada) {
      const visitaId = await resolverVisitaDaSaida(item, entrada, rodada);
      if (!visitaId) {
        // A entrada foi recusada ou nunca chegou: não há visita para encerrar.
        await removerDaFila(item.chave);
        return "descartado";
      }
      envio = { ...item, corpo: { ...item.corpo, visitaId } };
    }

    const resposta = await VisitaService.enviarEventoOffline(envio);
    await removerDaFila(item.chave);
    await aposEntregar(envio, resposta, seguintes, rodada);
    return "enviado";
  } catch (erro) {
    return tratarFalha(item, erro, rodada);
  }
}

async function tratarFalha(item, erro, rodada) {
  if (semDecisaoDoServidor(erro)) {
    // Continua sem resposta: parar aqui preserva a ordem dos eventos e evita
    // gastar tentativa de todos os itens numa rodada que não vai passar.
    return "parar";
  }

  const definitiva = recusaDefinitiva(erro) && !(erro instanceof ErroAoConferirVisita);
  if (!definitiva && (item.tentativas || 0) + 1 < MAX_TENTATIVAS) {
    await marcarTentativa(item.chave);
    return "mantido";
  }

  await removerDaFila(item.chave);
  if (item.tipo === "checkin") {
    rodada.recusadas.add(item.chave);
    await avisar({ tipo: "entradaRecusada", chaveEntrada: item.chave, hospitalId: item.corpo?.hospitalId });
  }
  return "descartado";
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
    // Desfecho das entradas desta rodada, pela chave: a saída guardada logo atrás usa.
    const rodada = { entregues: {}, recusadas: new Set() };

    for (const [posicao, item] of itens.entries()) {
      const desfecho = await processarItem(item, itens.slice(posicao + 1), rodada);
      if (desfecho === "parar") {
        break;
      }
      enviados += desfecho === "enviado" ? 1 : 0;
      descartados += desfecho === "descartado" ? 1 : 0;
    }
  } finally {
    emAndamento = false;
  }

  if (enviados > 0) {
    // Check-in ou checkout guardado offline acabou de chegar ao servidor: a visita
    // ativa mudou, e o heartbeat e o geofencing precisam seguir a visita nova.
    void invalidarVisitaAtiva();
  }

  const pendentes = (await itensDaFila()).length;

  return { enviados, descartados, pendentes, ignorado: false };
}

/**
 * Depois de um envio aceito: o check-in grava o número da visita na saída que o espera e
 * avisa o geofencing; a saída que esperava a entrada avisa para o convite de feedback.
 */
async function aposEntregar(item, resposta, seguintes, rodada) {
  const hospitalId = item.corpo?.hospitalId;
  // O servidor devolve a visita já aberta quando há uma (RN-03): só vale a da mesma unidade.
  if (item.tipo === "checkin" && resposta?.id && (!resposta.hospitalId || resposta.hospitalId === hospitalId)) {
    rodada.entregues[item.chave] = resposta.id;
    await vincularSaidaPendente(item.chave, resposta.id);
    await avisar({
      tipo: "entrada",
      chaveEntrada: item.chave,
      hospitalId,
      visitaId: resposta.id,
      entrada: resposta.entrada || item.ocorridoEm,
      saidaPendente: seguintes.some((proximo) => entradaEsperada(proximo)?.chave === item.chave),
    });
    return;
  }

  if (item.tipo === "checkout" && item.corpo?.entradaPendente) {
    await avisar({
      tipo: "saida",
      hospitalId: item.corpo.entradaPendente.hospitalId,
      visitaId: item.corpo.visitaId,
      duracaoMinutos: resposta?.duracaoMinutos,
    });
  }
}

export default { sincronizar, definirObservador, MAX_TENTATIVAS };
