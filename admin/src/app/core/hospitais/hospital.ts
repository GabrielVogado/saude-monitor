import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Hospital, ListarHospitaisParams, PageResponse } from './hospital.models';

/**
 * Cliente da API de hospitais para o painel admin.
 *
 * Usa o endpoint admin `GET /api/v1/admin/hospitais` (protegido por papel ADMIN no
 * backend), que — diferente do público `/api/v1/hospitais` (só ativos) — lista também
 * inativos e aceita filtro de `status` (ATIVOS/INATIVOS/TODOS). O token vai pelo
 * interceptor JWT.
 */
@Injectable({ providedIn: 'root' })
export class HospitalApi {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  listar(params: ListarHospitaisParams = {}): Observable<PageResponse<Hospital>> {
    let httpParams = new HttpParams()
      .set('status', params.status ?? 'TODOS')
      .set('page', String(params.page ?? 0))
      .set('size', String(params.size ?? 20));
    if (params.busca?.trim()) {
      httpParams = httpParams.set('busca', params.busca.trim());
    }
    if (params.tipo) {
      httpParams = httpParams.set('tipo', params.tipo);
    }
    if (params.regiaoAdministrativa?.trim()) {
      httpParams = httpParams.set('regiaoAdministrativa', params.regiaoAdministrativa.trim());
    }
    return this.http.get<PageResponse<Hospital>>(`${this.apiBaseUrl}/api/v1/admin/hospitais`, {
      params: httpParams,
    });
  }

  /**
   * Ativa/desativa um hospital (E7-07) — `PATCH /api/v1/hospitais/{id}/status`
   * (restrito a ADMIN no backend). O corpo é `{ ativo }`.
   */
  alterarStatus(id: string, ativo: boolean): Observable<Hospital> {
    return this.http.patch<Hospital>(`${this.apiBaseUrl}/api/v1/hospitais/${id}/status`, { ativo });
  }
}
