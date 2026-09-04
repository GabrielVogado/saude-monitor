import { buildApiUrl } from "../../../config/api";

import {
  ErroEnfileirado,
  ErroSemInternet,
  classificarErroDeRede,
  fetchComRetry,
} from "../../../config/http";
import { enfileirar } from "../../../config/filaOffline";
import { geracaoDaSessao, renovarSessao } from "../../../config/sessao";
import TokenStorage from "../../../services/TokenStorage";
import DispositivoId from "../../../services/DispositivoId";
import LoginService from "../../auth/service/LoginService";

const BASE_PATH = "/api/v1/visitas";

/**
 * Cabeçalhos de autenticação (JWT). Anexa `Authorization: Bearer <accessToken>`
 * quando houver sessão ativa; vazio para chamadas anônimas (check-in/checkout/
 * heartbeat via `dispositivoId`, §3.3).
 */
async function authHeaders() {
  const token = await TokenStorage.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Cliente HTTP compartilhado, com tratamento de erro pt-BR, envelope de erro
 * padronizado (Especificacao-API-v2.0 §1.1) e renovação automática do token
 * (401 → refresh → retry único). Replica o padrão de `HospitalService.js`.
 *
 * `idempotente` marca as chamadas que podem ser repetidas pelo backoff (OPS-05)
 * mesmo não sendo GET — ver `fetchComRetry`.
 */
async function request(path, { method = "GET", body, headers = {}, idempotente } = {}) {
  const doFetch = async () => {
    const url = buildApiUrl(path);
    const config = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
        ...headers,
      },
    };

    if (body !== undefined) {
      config.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    let response;
    try {
      response = await fetchComRetry(url, config, { idempotente });
    } catch (error) {
      throw await classificarErroDeRede(error, url);
    }

    return response;
  };

  // Geração lida antes do 401: se ela mudar, outra requisição já renovou a
  // sessão e esta só precisa repetir a chamada com o token novo.
  const geracao = geracaoDaSessao();
  let response = await doFetch();

  if (response.status === 401) {
    const refreshToken = await TokenStorage.getRefreshToken();
    if (refreshToken) {
      try {
        await renovarSessao(() => LoginService.refresh(), geracao);
        response = await doFetch();
      } catch {
        await LoginService.logout();
        throw new Error("Sessão expirada. Faça login novamente.");
      }
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
    const message =
      data?.message ||
      data?.error ||
      `Falha na requisição (HTTP ${response.status}).`;
    const erro = new Error(message);
    // Anexa status HTTP e corpo bruto para tratamentos específicos (ex.: 409 de
    // conflito de geofence com `candidatos`, E2-04) sem quebrar quem só usa `.message`.
    erro.status = response.status;
    erro.data = data;
    throw erro;
  }

  return data;
}

function buildQuery(params = {}) {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  return query ? `?${query}` : "";
}

/**
 * Guarda o evento na fila offline (OPS-05) e devolve o erro que a tela — ou a
 * tarefa de background — deve propagar.
 *
 * Chamado somente quando a falha foi por falta de internet, isto é, quando a
 * requisição não chegou a sair do aparelho. Nesse caso o reenvio é seguro: não
 * existe a dúvida de "o servidor chegou a receber?" que impediria repetir.
 */
async function guardarOffline({ chave, tipo, corpo }) {
  await enfileirar({ chave, tipo, corpo });

  return new ErroEnfileirado();
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

  /** Registra saída (E2-02/E2-05). `gpsIndisponivel` encerra como GPS_INTERROMPIDO. */
  static async checkout(id, { posicao, gpsIndisponivel, encerramentoManual } = {}) {
    const corpo = { posicao, gpsIndisponivel, encerramentoManual };

    try {
      // Repetível pelo mesmo motivo do check-in: o checkout é endereçado à
      // visita, e a segunda chegada encontra a visita já encerrada (409).
      return await request(`${BASE_PATH}/${id}/checkout`, {
        method: "POST",
        body: corpo,
        idempotente: true,
      });
    } catch (erro) {
      if (erro instanceof ErroSemInternet) {
        throw await guardarOffline({
          chave: `checkout:${id}`,
          tipo: "checkout",
          corpo: { visitaId: id, ...corpo },
        });
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
   */
  static enviarEventoOffline(item) {
    if (item?.tipo === "checkin") {
      return request(`${BASE_PATH}/checkin`, {
        method: "POST",
        body: { ...item.corpo, ocorridoEm: item.ocorridoEm },
        idempotente: true,
      });
    }

    if (item?.tipo === "checkout") {
      const { visitaId, ...dados } = item.corpo || {};
      return request(`${BASE_PATH}/${visitaId}/checkout`, {
        method: "POST",
        body: { ...dados, ocorridoEm: item.ocorridoEm },
        idempotente: true,
      });
    }

    return Promise.reject(new Error(`Evento desconhecido na fila offline: ${item?.tipo}`));
  }

  /** Sinal de vida da visita ativa (E2-09); posição opcional renova o sinal de GPS (E2-05). */
  static heartbeat(id, posicao) {
    return request(`${BASE_PATH}/${id}/heartbeat`, {
      method: "POST",
      body: posicao ? { posicao } : {},
    });
  }

  /** Sinaliza observação/internação após 12h de visita ativa (E2-10). */
  static definirTipoPermanencia(id, tipoPermanencia) {
    return request(`${BASE_PATH}/${id}/tipo-permanencia`, {
      method: "PATCH",
      body: { tipoPermanencia },
    });
  }

  /** Visita ativa do usuário/dispositivo, para o card/cronômetro (E2-07). */
  static async buscarAtiva() {
    const dispositivoId = (await TokenStorage.getAccessToken())
      ? undefined
      : await DispositivoId.obter();
    return request(`${BASE_PATH}/ativas${buildQuery({ dispositivoId })}`);
  }

  /** Histórico paginado de visitas do usuário (E5-03 — namespace contas). */
  static listarHistorico({ page = 0, size = 20 } = {}) {
    return request(`/api/v1/contas/visitas${buildQuery({ page, size })}`);
  }
}

export default VisitaService;
