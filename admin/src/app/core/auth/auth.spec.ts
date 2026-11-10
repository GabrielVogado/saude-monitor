import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';

import { AcessoNaoAdminError, Auth } from './auth';
import { API_BASE_URL } from '../config/api.config';

const BASE = 'https://api.test';
const LOGIN = `${BASE}/api/v1/auth/painel/login`;
const REFRESH = `${BASE}/api/v1/auth/painel/refresh`;
const LOGOUT = `${BASE}/api/v1/auth/painel/logout`;
const respostaAdmin = {
  accessToken: 'a.b.c',
  expiraEm: 900,
  usuario: { id: '1', nome: 'Admin', email: 'admin@x.com', papel: 'ADMIN' },
};

/** Todo o conteúdo do sessionStorage, para conferir que nenhum token foi parar lá. */
function conteudoDoSessionStorage(): string {
  return Object.keys(sessionStorage)
    .map((chave) => `${chave}=${sessionStorage.getItem(chave)}`)
    .join('\n');
}

/** Pedido de sessão como o backend exige: cookie liberado e cabeçalho anti-CSRF. */
function conferirOpcoesDeSessao(req: TestRequest): void {
  expect(req.request.method).toBe('POST');
  expect(req.request.withCredentials).toBe(true);
  expect(req.request.headers.get('X-Requested-With')).toBe('painel');
  expect(req.request.headers.has('Authorization')).toBe(false);
}

describe('Auth', () => {
  let service: Auth;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
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

  function logar() {
    service.login('admin@x.com', 'senha').subscribe();
    http.expectOne(LOGIN).flush(respostaAdmin);
  }

  it('autentica ADMIN pelo login do painel e guarda o access só em memória', () => {
    let recebido: unknown;
    service.login(' admin@x.com ', 'senha').subscribe((u) => (recebido = u));

    const req = http.expectOne(LOGIN);
    conferirOpcoesDeSessao(req);
    expect(req.request.body).toEqual({ email: 'admin@x.com', password: 'senha', rememberDevice: false });
    req.flush(respostaAdmin);

    expect(recebido).toEqual(respostaAdmin.usuario);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.accessToken).toBe('a.b.c');
    expect(conteudoDoSessionStorage()).not.toContain('a.b.c');
    expect(JSON.parse(sessionStorage.getItem('admin.usuario')!)).toEqual(respostaAdmin.usuario);
  });

  it('não usa mais os endpoints de login e refresh do app', () => {
    logar();
    service.renovar().subscribe();
    http.expectOne(REFRESH).flush(respostaAdmin);

    expect(http.match(`${BASE}/api/v1/auth/login`)).toHaveLength(0);
    expect(http.match(`${BASE}/api/v1/auth/refresh`)).toHaveLength(0);
  });

  it('recusa conta não-ADMIN sem autenticar', () => {
    let erro: unknown;
    service.login('user@x.com', 'senha').subscribe({ error: (e) => (erro = e) });

    http.expectOne(LOGIN).flush({ ...respostaAdmin, usuario: { ...respostaAdmin.usuario, papel: 'USUARIO' } });

    expect(erro).toBeInstanceOf(AcessoNaoAdminError);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.accessToken).toBeNull();
  });

  it('logout limpa a sessão local e pede ao backend que revogue e apague o cookie', () => {
    logar();

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.accessToken).toBeNull();
    expect(service.usuario()).toBeNull();
    expect(sessionStorage.getItem('admin.usuario')).toBeNull();
    const req = http.expectOne(LOGOUT);
    conferirOpcoesDeSessao(req);
    req.flush({ success: true });
  });

  it('encerrarSessaoLocal limpa só esta aba, sem revogar o cookie que outra aba pode ter renovado', () => {
    logar();

    service.encerrarSessaoLocal();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.usuario()).toBeNull();
    expect(sessionStorage.getItem('admin.usuario')).toBeNull();
    http.expectNone(LOGOUT);
  });

  it('logout sem rede não lança: a sessão local já acabou', () => {
    logar();

    service.logout();
    http.expectOne(LOGOUT).error(new ProgressEvent('error'));

    expect(service.isAuthenticated()).toBe(false);
  });

  describe('renovar', () => {
    const renovado = { ...respostaAdmin, accessToken: 'novo.access' };

    it('renova pelo cookie, sem refresh token no corpo', () => {
      logar();
      let token: string | undefined;
      service.renovar().subscribe((t) => (token = t));

      const req = http.expectOne(REFRESH);
      conferirOpcoesDeSessao(req);
      expect(req.request.body).toBeNull();
      req.flush(renovado);

      expect(token).toBe('novo.access');
      expect(service.accessToken).toBe('novo.access');
      expect(conteudoDoSessionStorage()).not.toContain('novo.access');
    });

    it('chamadas simultâneas compartilham um único POST /refresh', () => {
      logar();
      const tokens: string[] = [];
      service.renovar().subscribe((t) => tokens.push(t));
      service.renovar().subscribe((t) => tokens.push(t));

      http.expectOne(REFRESH).flush(renovado);

      expect(tokens).toEqual(['novo.access', 'novo.access']);
      // Terminada a renovação, a próxima faz outra chamada.
      service.renovar().subscribe();
      http.expectOne(REFRESH).flush(renovado);
    });

    it('recusa renovação que devolve conta não-ADMIN', () => {
      logar();
      let erro: unknown;
      service.renovar().subscribe({ error: (e) => (erro = e) });

      http.expectOne(REFRESH).flush({ ...renovado, usuario: { ...renovado.usuario, papel: 'USUARIO' } });

      expect(erro).toBeInstanceOf(AcessoNaoAdminError);
      expect(service.accessToken).toBe('a.b.c');
    });
  });

  describe('restaurarSessao (aba aberta ou recarregada)', () => {
    it('recupera a sessão pelo cookie de refresh', () => {
      expect(service.isAuthenticated()).toBe(false);
      let ok: boolean | undefined;
      service.restaurarSessao().subscribe((r) => (ok = r));

      const req = http.expectOne(REFRESH);
      conferirOpcoesDeSessao(req);
      req.flush(respostaAdmin);

      expect(ok).toBe(true);
      expect(service.isAuthenticated()).toBe(true);
      expect(service.usuario()).toEqual(respostaAdmin.usuario);
    });

    it('sem cookie válido, emite false e limpa o usuário guardado', () => {
      sessionStorage.setItem('admin.usuario', JSON.stringify(respostaAdmin.usuario));
      let ok: boolean | undefined;
      service.restaurarSessao().subscribe((r) => (ok = r));

      http.expectOne(REFRESH).flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(ok).toBe(false);
      expect(service.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem('admin.usuario')).toBeNull();
    });

    it('com sessão em memória, não chama a API', () => {
      logar();
      let ok: boolean | undefined;
      service.restaurarSessao().subscribe((r) => (ok = r));

      http.expectNone(REFRESH);
      expect(ok).toBe(true);
    });
  });
});
