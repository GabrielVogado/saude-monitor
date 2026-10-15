/**
 * Erro de resposta HTTP da API (status fora de 2xx), no mesmo formato para todos os
 * serviços.
 *
 * Antes da unificação do cliente (auditoria técnica v4, §4.1), cada serviço montava o
 * próprio `Error`, e o `HospitalService` não anexava `status` nem `data`: quem lia o
 * erro não conseguia distinguir um 404 (não adianta repetir) de um 500. `status` e
 * `data` permitem tratar casos específicos (ex.: 409 de empate de geofence com
 * `candidatos`, E2-04) sem quebrar quem só usa `.message`.
 *
 * Falha de transporte (sem internet, timeout, servidor fora do ar) não chega aqui: é
 * um `ErroDeConexao` de `config/http.js`, que não tem `status`.
 */
export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}
