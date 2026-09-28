import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { HospitalApi } from './hospital';
import { API_BASE_URL } from '../config/api.config';

const BASE = 'https://api.test';
const pagina = {
  content: [{ id: '1', nome: 'Hosp A', tipo: 'PUBLICO', ativo: true }],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};

describe('HospitalApi', () => {
  let api: HospitalApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
    api = TestBed.inject(HospitalApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('usa o endpoint admin com status TODOS por padrão', () => {
    let resp: unknown;
    api.listar({ busca: 'ana', page: 2, size: 10 }).subscribe((r) => (resp = r));

    const req = http.expectOne((r) => r.url === `${BASE}/api/v1/admin/hospitais`);
    expect(req.request.params.get('status')).toBe('TODOS');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('busca')).toBe('ana');
    req.flush(pagina);

    expect(resp).toEqual(pagina);
  });

  it('envia o status escolhido e omite a busca vazia', () => {
    api.listar({ status: 'INATIVOS' }).subscribe();
    const req = http.expectOne((r) => r.url === `${BASE}/api/v1/admin/hospitais`);
    expect(req.request.params.get('status')).toBe('INATIVOS');
    expect(req.request.params.has('busca')).toBe(false);
    expect(req.request.params.get('page')).toBe('0');
    req.flush(pagina);
  });

  it('envia regiaoAdministrativa quando informada e omite quando vazia', () => {
    api.listar({ regiaoAdministrativa: 'Plano Piloto' }).subscribe();
    const req = http.expectOne((r) => r.url === `${BASE}/api/v1/admin/hospitais`);
    expect(req.request.params.get('regiaoAdministrativa')).toBe('Plano Piloto');
    req.flush(pagina);

    api.listar({ regiaoAdministrativa: '  ' }).subscribe();
    const req2 = http.expectOne((r) => r.url === `${BASE}/api/v1/admin/hospitais`);
    expect(req2.request.params.has('regiaoAdministrativa')).toBe(false);
    req2.flush(pagina);
  });

  it('edita via PUT /api/v1/hospitais/{id} com o corpo informado (E7-06)', () => {
    const corpo = {
      nome: 'Hosp A',
      cnpj: null,
      tipo: 'PUBLICO' as const,
      categoria: 'UPA' as const,
      endereco: { logradouro: 'Rua 1', cidade: 'Brasília', uf: 'DF' },
      contato: null,
      geofence: { type: 'Polygon' as const, coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] },
    };
    let resp: unknown;
    api.atualizar('h1', corpo).subscribe((r) => (resp = r));
    const req = http.expectOne(`${BASE}/api/v1/hospitais/h1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(corpo);
    req.flush({ id: 'h1', nome: 'Hosp A', tipo: 'PUBLICO', ativo: true });
    expect(resp).toEqual({ id: 'h1', nome: 'Hosp A', tipo: 'PUBLICO', ativo: true });
  });

  it('altera status via PATCH /{id}/status com corpo { ativo }', () => {
    api.alterarStatus('h1', false).subscribe();
    const req = http.expectOne(`${BASE}/api/v1/hospitais/h1/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ ativo: false });
    req.flush({});
  });
});
