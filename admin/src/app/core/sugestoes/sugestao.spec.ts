import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SugestaoApi } from './sugestao';
import { API_BASE_URL } from '../config/api.config';

const BASE = 'https://api.test';

describe('SugestaoApi', () => {
  let api: SugestaoApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: BASE }],
    });
    api = TestBed.inject(SugestaoApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista filtrando por status e paginando', () => {
    api.listar('PENDENTE', 2, 10).subscribe();
    const req = http.expectOne((r) => r.url === `${BASE}/api/v1/hospitais/sugestoes`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('PENDENTE');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('10');
    req.flush({ content: [], page: 2, size: 10, totalElements: 0, totalPages: 0 });
  });

  it('sem status não manda o parâmetro (backend devolve todas)', () => {
    api.listar(null).subscribe();
    const req = http.expectOne((r) => r.url === `${BASE}/api/v1/hospitais/sugestoes`);
    expect(req.request.params.has('status')).toBe(false);
    req.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
  });

  it('aprovar envia o hospital vinculado', () => {
    api.aprovar('s1', 'h9').subscribe();
    const req = http.expectOne(`${BASE}/api/v1/hospitais/sugestoes/s1/aprovar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ hospitalId: 'h9' });
    req.flush({});
  });

  it('rejeitar envia o motivo', () => {
    api.rejeitar('s1', 'Duplicada').subscribe();
    const req = http.expectOne(`${BASE}/api/v1/hospitais/sugestoes/s1/rejeitar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ motivo: 'Duplicada' });
    req.flush({});
  });
});
