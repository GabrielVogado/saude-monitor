import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Fila de eventos pendentes de envio (OPS-05).
 *
 * O caso que motiva esta fila está descrito na lacuna OPS-01: o check-in do
 * geofencing dispara **em segundo plano, sem ninguém olhando a tela**. Se a
 * requisição falha ali, não existe botão de "tentar novamente" — a visita
 * simplesmente não aconteceu, e nem o usuário nem nós ficamos sabendo. O retry
 * com backoff cobre a falha passageira de servidor; esta fila cobre a outra
 * metade, a do aparelho sem internet, em que não há o que repetir agora.
 *
 * Só entram aqui eventos cujo reenvio é seguro:
 *
 * - o servidor precisa tratá-los por identidade, não por chegada (check-in e
 *   checkout são resolvidos pela visita ativa, §3.3/RN-03), e
 * - o momento real do evento vai no corpo (`ocorridoEm`), porque o envio
 *   acontece depois — sem isso a visita registraria a hora em que a internet
 *   voltou, e o indicador de tempo de permanência mediria a conectividade do
 *   aparelho em vez da fila do hospital.
 *
 * A fila é um armazenamento burro de propósito: não conhece HTTP nem serviço
 * nenhum. Quem reenvia é o `SincronizacaoOffline`, que sabe chamar a API.
 */

const CHAVE = "@saude_monitor:filaOffline";

/**
 * Teto de itens guardados. Estourou, o mais antigo sai: um aparelho semanas
 * offline não deve encher o armazenamento, e evento antigo já perdeu o valor.
 */
export const LIMITE_ITENS = 50;

/**
 * Validade de um item. Depois de 24h o evento é descartado: é a mesma janela em
 * que o backend expira uma visita sem sinal de vida (RN-09/E2-09), então
 * reenviar depois disso não reconstruiria nada — só criaria registro falso.
 */
export const VALIDADE_MS = 24 * 60 * 60 * 1000;

async function ler() {
  const bruto = await AsyncStorage.getItem(CHAVE);

  if (!bruto) {
    return [];
  }

  try {
    const lista = JSON.parse(bruto);
    return Array.isArray(lista) ? lista : [];
  } catch {
    // Conteúdo corrompido não pode travar o app: começa uma fila nova.
    return [];
  }
}

async function gravar(itens) {
  if (itens.length === 0) {
    await AsyncStorage.removeItem(CHAVE);
    return;
  }

  await AsyncStorage.setItem(CHAVE, JSON.stringify(itens));
}

function vigente(item, agora) {
  return agora - Number(new Date(item.ocorridoEm).getTime()) < VALIDADE_MS;
}

/**
 * Guarda um evento para envio posterior.
 *
 * `chave` identifica o evento no mundo real (ex.: `checkout:<visitaId>`) e é
 * única na fila: reenfileirar o mesmo evento substitui o anterior em vez de
 * empilhar. Sem isso, um aparelho que tenta o mesmo checkout a cada volta ao
 * primeiro plano acumularia dezenas de cópias do mesmo fato.
 */
export async function enfileirar({ chave, tipo, corpo, ocorridoEm }) {
  const agora = Date.now();
  const item = {
    chave,
    tipo,
    corpo,
    ocorridoEm: ocorridoEm || new Date(agora).toISOString(),
    tentativas: 0,
  };

  const itens = (await ler())
    .filter((existente) => existente.chave !== chave)
    .filter((existente) => vigente(existente, agora));

  itens.push(item);
  await gravar(itens.slice(-LIMITE_ITENS));

  return item;
}

/** Itens ainda dentro da validade, do mais antigo para o mais novo. */
export async function itensDaFila() {
  const agora = Date.now();
  const itens = await ler();
  const vigentes = itens.filter((item) => vigente(item, agora));

  if (vigentes.length !== itens.length) {
    await gravar(vigentes);
  }

  return vigentes;
}

export async function tamanhoDaFila() {
  return (await itensDaFila()).length;
}

export async function removerDaFila(chave) {
  const itens = await ler();
  await gravar(itens.filter((item) => item.chave !== chave));
}

/** Registra uma tentativa fracassada, mantendo o item na fila. */
export async function marcarTentativa(chave) {
  const itens = await ler();
  const item = itens.find((atual) => atual.chave === chave);

  if (!item) {
    return;
  }

  item.tentativas = (item.tentativas || 0) + 1;
  await gravar(itens);
}

export async function limparFila() {
  await AsyncStorage.removeItem(CHAVE);
}
