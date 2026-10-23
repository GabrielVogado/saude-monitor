import { ErroDeConexao, ErroEnfileirado, ErroSemInternet } from "../../../config/http";
import { enfileirar } from "../../../config/filaOffline";
import { apiRequest as request, buildQuery } from "../../../core/api/apiClient";
import TokenStorage from "../../../services/TokenStorage";
import DispositivoId from "../../../services/DispositivoId";

const BASE_PATH = "/api/v1/visitas";

/**
 * Guarda o evento na fila offline (OPS-05) e devolve o erro que a tela — ou a
 * tarefa de background — deve propagar.
 *
 * Chamado somente quando a falha foi por falta de internet, isto é, quando a
 * requisição não chegou a sair do aparelho. Nesse caso o reenvio é seguro: não
 * existe a dúvida de "o servidor chegou a receber?" que impediria repetir.
 */
async function guardarOffline({ chave, tipo, corpo, ocorridoEm }, mensagem) {
  await enfileirar({ chave, tipo, corpo, ocorridoEm });

  return new ErroEnfileirado(undefined, mensagem);
}

const MENSAGEM_SERVIDOR_FORA =
  "Não foi possível falar com o servidor agora. A saída foi guardada e será enviada em seguida.";

/**
 * O checkout também vai para a fila quando o servidor não respondeu (timeout, servidor fora
 * ou 5xx depois das novas tentativas), e não só sem internet. Teste de campo de 23/10/2026:
 * com sinal fraco na saída, o checkout se perdia e a visita ficava GPS_INTERROMPIDO com 0 min.
 * O reenvio é seguro mesmo que o primeiro pedido tenha chegado: a segunda chegada encontra
 * a visita encerrada (409) e sai da fila.
 */
function isFalhaSemResposta(erro) {
  return erro instanceof ErroDeConexao || (Number.isInteger(erro?.status) && erro.status >= 500);
}

class VisitaService {
  /**
   * Registra entrada (E2-01/E2-06). `origem` = "GEOFENCE" | "MANUAL".
   * `posicao` é obrigatória para GEOFENCE; `dispositivoId` permite visita anônima.
   * Quando não autenticado, o `dispositivoId` é gerado/persistido automaticamente
   * (modo anônimo sem login — §3.3 / RN-03).
   * Em caso de empate de geofences (E2-04), o backend responde 409 com `candidatos`.
   */
  static async checkin({ hospitalId, origem, posicao, dispositivoId }) {
    const corpo = { hospitalId, origem, posicao };
    if (dispositivoId) {
      corpo.dispositivoId = dispositivoId;
    } else if (!(await TokenStorage.getAccessToken())) {
      corpo.dispositivoId = await DispositivoId.obter();
    }
    try {
      // Repetível apesar de POST: o backend resolve o check-in pela visita ativa
      // do usuário/dispositivo e devolve a existente em vez de criar outra
      // (§3.3/RN-03), então a repetição do backoff não duplica visita.
      return await request(`${BASE_PATH}/checkin`, {
        method: "POST",
        body: corpo,
        idempotente: true,
      });
    } catch (erro) {
      if (erro instanceof ErroSemInternet) {
        // OPS-01: este é o caminho do geofencing em segundo plano, sem tela e
        // sem usuário. Sem a fila, a visita se perderia em silêncio.
        throw await guardarOffline({
          chave: `checkin:${hospitalId}`,
          tipo: "checkin",
          corpo,
        });
      }
      throw erro;
    }
  }

  /**
   * Registra saída (E2-02/E2-05). `gpsIndisponivel` encerra como GPS_INTERROMPIDO.
   *
   * O `dispositivoId` vai sempre: numa visita anônima ele é a prova de que este é o
   * aparelho que fez o check-in, e o backend recusa (403) quem não o tem. Vale também
   * para quem fez login no meio de uma visita que começou anônima.
   *
   * `ocorridoEm` (ISO) é o momento em que o aparelho viu a pessoa sair, que chega aqui
   * depois da tolerância da RN-03: sem ele a visita contaria esses minutos como
   * permanência (teste de campo da rc.6, 21/10/2026).
   */
  static async checkout(id, { posicao, gpsIndisponivel, encerramentoManual, ocorridoEm } = {}) {
    // Hora do pedido, para a fila: sem ela, um checkout manual guardado depois dos timeouts
    // e das novas tentativas registraria como saída o instante em que foi guardado.
    const pedidoEm = new Date().toISOString();
    const corpo = {
      posicao,
      gpsIndisponivel,
      encerramentoManual,
      ocorridoEm,
      dispositivoId: await DispositivoId.obterSeDisponivel(),
    };

    try {
      // Repetível pelo mesmo motivo do check-in: o checkout é endereçado à
      // visita, e a segunda chegada encontra a visita já encerrada (409).
      return await request(`${BASE_PATH}/${id}/checkout`, {
        method: "POST",
        body: corpo,
        idempotente: true,
      });
    } catch (erro) {
      if (isFalhaSemResposta(erro)) {
        const evento = {
          chave: `checkout:${id}`,
          tipo: "checkout",
          corpo: { visitaId: id, ...corpo },
          ocorridoEm: ocorridoEm || pedidoEm,
        };
        throw await guardarOffline(evento, erro instanceof ErroSemInternet ? undefined : MENSAGEM_SERVIDOR_FORA);
      }
      throw erro;
    }
  }

  /**
   * Reenvia um item da fila offline (OPS-05). Usado apenas pelo
   * `SincronizacaoOffline`; não enfileira de novo em caso de falha, porque o
   * item já está na fila — quem decide mantê-lo ou descartá-lo é o sincronizador.
   *
   * O `ocorridoEm` carrega o momento real do evento, não o do reenvio: sem ele a
   * visita registraria a hora em que a internet voltou.
   *
   * Um checkout guardado antes de o app mandar o `dispositivoId` ganha o do aparelho
   * no reenvio, para não ser recusado como de outro dono.
   */
  static async enviarEventoOffline(item) {
    if (item?.tipo === "checkin") {
      return request(`${BASE_PATH}/checkin`, {
        method: "POST",
        body: { ...item.corpo, ocorridoEm: item.ocorridoEm },
        idempotente: true,
      });
    }

    if (item?.tipo === "checkout") {
      const { visitaId, ...dados } = item.corpo || {};
      const dispositivoId = dados.dispositivoId || (await DispositivoId.obterSeDisponivel());
      return request(`${BASE_PATH}/${visitaId}/checkout`, {
        method: "POST",
        body: { ...dados, dispositivoId, ocorridoEm: item.ocorridoEm },
        idempotente: true,
      });
    }

    throw new Error(`Evento desconhecido na fila offline: ${item?.tipo}`);
  }

  /**
   * Sinal de vida da visita ativa (E2-09); posição opcional renova o sinal de GPS (E2-05).
   * Leva o `dispositivoId` pelo mesmo motivo do checkout.
   */
  static async heartbeat(id, posicao) {
    const dispositivoId = await DispositivoId.obterSeDisponivel();
    return request(`${BASE_PATH}/${id}/heartbeat`, {
      method: "POST",
      body: posicao ? { posicao, dispositivoId } : { dispositivoId },
    });
  }

  /**
   * Sinaliza observação/internação após 12h de visita ativa (E2-10). O `dispositivoId`
   * cobre a visita que começou anônima antes do login.
   */
  static async definirTipoPermanencia(id, tipoPermanencia) {
    const dispositivoId = await DispositivoId.obterSeDisponivel();
    return request(`${BASE_PATH}/${id}/tipo-permanencia`, {
      method: "PATCH",
      body: { tipoPermanencia, dispositivoId },
    });
  }

  /** Visita ativa do usuário/dispositivo, para o card/cronômetro (E2-07). */
  static async buscarAtiva({ signal } = {}) {
    const dispositivoId = (await TokenStorage.getAccessToken())
      ? undefined
      : await DispositivoId.obter();
    return request(`${BASE_PATH}/ativas${buildQuery({ dispositivoId })}`, { signal });
  }

  /** Histórico paginado de visitas do usuário (E5-03 — namespace contas). */
  static listarHistorico({ page = 0, size = 20, signal } = {}) {
    return request(`/api/v1/contas/visitas${buildQuery({ page, size })}`, { signal });
  }
}

export default VisitaService;
