import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { PageResponse } from '../hospitais/hospital.models';
import { StatusSugestao, Sugestao } from './sugestao.models';

/**
 * Cliente da moderação de sugestões de hospital (E1-06), consumido pelo item
 * "Sugestões" do menu (E7-09). Os quatro endpoints já existiam e exigem papel ADMIN
 * no `SecurityConfig`; o token vai pelo interceptor JWT.
 */
@Injectable({ providedIn: 'root' })
export class SugestaoApi {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  /** `GET /api/v1/hospitais/sugestoes`; sem `status`, o backend devolve todas. */
  listar(status: StatusSugestao | null, page = 0, size = 20): Observable<PageResponse<Sugestao>> {
    let params = new HttpParams().set('page', String(page)).set('size', String(size));
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<PageResponse<Sugestao>>(`${this.apiBaseUrl}/api/v1/hospitais/sugestoes`, { params });
  }

  /** Aprova vinculando a sugestão a um hospital já cadastrado (`hospitalId` obrigatório no backend). */
  aprovar(id: string, hospitalId: string): Observable<Sugestao> {
    return this.http.post<Sugestao>(`${this.apiBaseUrl}/api/v1/hospitais/sugestoes/${id}/aprovar`, {
      hospitalId,
    });
  }

  /** Recusa com motivo (5 a 500 caracteres no backend). */
  rejeitar(id: string, motivo: string): Observable<Sugestao> {
    return this.http.post<Sugestao>(`${this.apiBaseUrl}/api/v1/hospitais/sugestoes/${id}/rejeitar`, {
      motivo,
    });
  }
}
