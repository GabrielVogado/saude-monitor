import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { Camada } from './camada';
import { API_BASE_URL } from '../config/api.config';

const BASE = 'https://api.test';

describe('Camada', () => {
  let camada: Camada;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
    camada = TestBed.inject(Camada);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('extrai e ordena os nomes de properties.nome da FeatureCollection', () => {
    let resultado: string[] | undefined;
    camada.nomesRegiaoAdministrativa().subscribe((r) => (resultado = r));

    const req = http.expectOne(`${BASE}/api/v1/camadas/regiao-administrativa`);
    expect(req.request.method).toBe('GET');
    req.flush({
      type: 'FeatureCollection',
      features: [
        { properties: { nome: 'Taguatinga' } },
        { properties: { nome: 'Águas Claras' } },
        { properties: {} }, // sem nome: descartado
        { properties: { nome: 'Ceilândia' } },
      ],
    });

    expect(resultado).toEqual(['Águas Claras', 'Ceilândia', 'Taguatinga']);
  });
});
