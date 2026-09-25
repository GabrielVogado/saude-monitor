import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Hospital, ListarHospitaisParams, PageResponse } from './hospital.models';

/**
 * Cliente da API de hospitais.
 *
 * NOTA (E7-02): `GET /api/v1/hospitais` é público e retorna **apenas ativos**. A
 * listagem admin incluindo inativos depende de mudança no backend (registrada como
 * dependência do Épico 7); quando existir, este método passa a usá-la.
 */
@Injectable({ providedIn: 'root' })
export class HospitalApi {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  listar(params: ListarHospitaisParams = {}): Observable<PageResponse<Hospital>> {
    let httpParams = new HttpParams()
      .set('page', String(params.page ?? 0))
      .set('size', String(params.size ?? 20));
    if (params.busca?.trim()) {
      httpParams = httpParams.set('busca', params.busca.trim());
    }
    if (params.tipo) {
      httpParams = httpParams.set('tipo', params.tipo);
    }
    return this.http.get<PageResponse<Hospital>>(`${this.apiBaseUrl}/api/v1/hospitais`, {
      params: httpParams,
    });
  }
}
