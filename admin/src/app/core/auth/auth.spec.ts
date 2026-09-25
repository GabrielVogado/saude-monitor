import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AcessoNaoAdminError, Auth } from './auth';
import { API_BASE_URL } from '../config/api.config';

const BASE = 'https://api.test';
const respostaAdmin = {
  accessToken: 'a.b.c',
  refreshToken: 'r.e.f',
  expiraEm: 900,
  usuario: { id: '1', nome: 'Admin', email: 'admin@x.com', papel: 'ADMIN' },
};

describe('Auth', () => {
  let service: Auth;
  let http: HttpTestingController;

  beforeEach(() => {
    try {
      sessionStorage.clear();
    } catch {
      /* jsdom sem storage: os métodos de storage já degradam sozinhos */
    }
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
    service = TestBed.inject(Auth);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('autentica ADMIN e passa a estar autenticado', () => {
    let recebido: unknown;
    service.login('admin@x.com', 'senha').subscribe((u) => (recebido = u));

    const req = http.expectOne(`${BASE}/api/v1/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'admin@x.com', password: 'senha', rememberDevice: false });
    req.flush(respostaAdmin);

    expect(recebido).toEqual(respostaAdmin.usuario);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.accessToken).toBe('a.b.c');
  });

  it('recusa conta não-ADMIN sem autenticar', () => {
    let erro: unknown;
    service.login('user@x.com', 'senha').subscribe({ error: (e) => (erro = e) });

    http
      .expectOne(`${BASE}/api/v1/auth/login`)
      .flush({ ...respostaAdmin, usuario: { ...respostaAdmin.usuario, papel: 'USUARIO' } });

    expect(erro).toBeInstanceOf(AcessoNaoAdminError);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.accessToken).toBeNull();
  });

  it('logout limpa a sessão', () => {
    service.login('admin@x.com', 'senha').subscribe();
    http.expectOne(`${BASE}/api/v1/auth/login`).flush(respostaAdmin);
    expect(service.isAuthenticated()).toBe(true);

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.accessToken).toBeNull();
    expect(service.usuario()).toBeNull();
  });
});
