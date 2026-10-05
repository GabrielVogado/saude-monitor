import { apiRequest as request, buildQuery } from "../../../core/api/apiClient";

const BASE_PATH = "/api/v1/hospitais";

class HospitalService {
  /**
   * Lista hospitais ativos (E1-03).
   * Query opcional: latitude, longitude, raioKm, tipo, busca, page, size.
   *
   * A busca por nome é insensível a acentos/caixa (normalizada no backend e,
   * defensivamente, na tela de listagem).
   */
  static listar({ latitude, longitude, raioKm, tipo, busca, page = 0, size = 20 } = {}) {
    return request(`${BASE_PATH}${buildQuery({ latitude, longitude, raioKm, tipo, busca, page, size })}`);
  }

  /**
   * Ranking público de hospitais (E4-05).
   *
   * `ordem` aceita `NOTA` (maior nota primeiro) ou `TEMPO` (menor tempo mediano
   * primeiro); `tipo` filtra por natureza do estabelecimento. Hospitais sem amostra
   * suficiente (RN-15) vêm com `indicadores.indicadoresDisponiveis = false` e são
   * posicionados ao final pelo backend.
   */
  static ranking({ ordem = "NOTA", tipo, page = 0, size = 20 } = {}) {
    return request(`${BASE_PATH}/ranking${buildQuery({ ordem, tipo, page, size })}`);
  }

  /**
   * Detalhe público do hospital (campos + indicadores embutidos).
   *
   * Campos esperados no JSON: `nome`, `tipo` (natureza), `categoria`
   * (HOSPITAL|UPA|UBS|OUTRO), `tipoUnidade` (ex.: "HOSPITAL GERAL"),
   * `horarioFuncionamento` (texto livre), `endereco`, `contato`, `geofence`,
   * `ativo`, `indicadores`.
   *
   * `tipoUnidade` e `horarioFuncionamento` são opcionais (o backend passa a
   * fornecê-los); consumidores devem tratar ausência com fallback elegante.
   */
  static buscarPorId(id) {
    return request(`${BASE_PATH}/${id}`);
  }

  /** Retorna apenas o geofence (renderização no mapa). */
  static buscarGeofence(id) {
    return request(`${BASE_PATH}/${id}/geofence`);
  }

  /**
   * Indicadores públicos enriquecidos do hospital (§3.5 / E4-01..E4-04).
   *
   * Campos: `hospitalId`, `indicadoresDisponiveis`, `notaMedia`, `nAvaliacoes`,
   * `tempoMedianoMinutos`, `nVisitas`, `periodo.{inicio,fim}`, `atualizadoEm`.
   * Quando `nAvaliacoes < 5`, `indicadoresDisponiveis = false` e `notaMedia`/
   * `tempoMedianoMinutos` são `null` (RN-15).
   */
  static buscarIndicadores(id) {
    return request(`${BASE_PATH}/${id}/indicadores`);
  }

  /**
   * Cadastro, atualização e ativação/desativação de hospital (E1-01/E1-02/E1-04)
   * são operações administrativas — migradas para o Painel Administrativo Web
   * (F-11). Este cliente mobile expõe apenas as operações públicas abaixo.
   */

  /** Sugestão pública de hospital ainda não cadastrado (E1-05, P2). */
  static sugerir(payload) {
    return request(`${BASE_PATH}/sugestoes`, { method: "POST", body: payload });
  }

  // Moderação de sugestões (listar/aprovar/rejeitar, E1-06, papel ADMIN) foi removida
  // deste cliente mobile em 08/09/2026: as telas que a usavam (SugestoesPendentesScreen/
  // RevisarSugestaoScreen) não tinham nenhum ponto de entrada no app e o fluxo de
  // aprovação navegava para uma rota inexistente — o CRUD administrativo migra
  // integralmente para o Painel Administrativo Web (F-11). Os endpoints continuam
  // ativos no backend para o futuro painel.
}

export default HospitalService;
