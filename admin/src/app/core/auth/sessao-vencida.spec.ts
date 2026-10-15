import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { appConfig } from '../../app.config';
import { API_BASE_URL } from '../config/api.config';
import { Auth } from './auth';
import { TokenStorage } from './token-storage';

/**
 * Regressão de 28/09/2026 (M-026): o access token vive 15 min e o painel não o renovava —
 * passado esse tempo, toda chamada voltava 401 em silêncio e o mapa ficava sem hospitais.
 *
 * Diferente dos specs de `Auth` e do `authInterceptor` (cada peça isolada, com dublês),
 * este sobe os providers **reais** do `appConfig`: se o interceptor sair da cadeia do
 * `provideHttpClient`, ou se `Auth` e interceptor deixarem de conversar, ele quebra.
 */
describe('Sessão vencida (appConfig real)', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let base: string;
  let storage: TokenStorage;
  let navegar: ReturnType<typeof vi.spyOn>;

  const usuario = { id: '1', nome: 'Admin', email: 'admin@x.com', papel: 'ADMIN' };
  const parNovo = { accessToken: 'access.novo', refreshToken: 'refresh.novo', expiraEm: 900, usuario };
  const nao401 = { status: 401, statusText: 'Unauthorized' };

  beforeEach(() => {
    try {
      sessionStorage.clear();
    } catch {
      /* jsdom sem storage */
    }
    TestBed.configureTestingModule({ providers: [...appConfig.providers, provideHttpClientTesting()] });
    storage = TestBed.inject(TokenStorage);
    // Sessão de um login feito há mais de 15 min: o access token já não vale.
    storage.salvar('access.vencido', 'refresh.valido', usuario);

    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    base = TestBed.inject(API_BASE_URL);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => backend.verify());

  const url = () => `${base}/api/v1/admin/hospitais`;

  it('401 por token vencido: renova, repete a chamada e entrega os dados', () => {
    let resposta: unknown;
    http.get(url()).subscribe((r) => (resposta = r));

    const primeira = backend.expectOne(url());
    expect(primeira.request.headers.get('Authorization')).toBe('Bearer access.vencido');
    primeira.flush({ message: 'expirado' }, nao401);

    const refresh = backend.expectOne(`${base}/api/v1/auth/refresh`);
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh.valido' });
    refresh.flush(parNovo);

    const repetida = backend.expectOne(url());
    expect(repetida.request.headers.get('Authorization')).toBe('Bearer access.novo');
    repetida.flush({ content: [{ id: 'h1' }], totalElements: 340 });

    expect(resposta).toEqual({ content: [{ id: 'h1' }], totalElements: 340 });
    expect(storage.getAccessToken()).toBe('access.novo');
    expect(storage.getRefreshToken()).toBe('refresh.novo');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('as 4 páginas do mapa vencendo juntas disparam um único refresh', () => {
    const recebidas: number[] = [];
    for (let pagina = 0; pagina < 4; pagina++) {
      http.get(url(), { params: { page: pagina } }).subscribe(() => recebidas.push(pagina));
    }

    backend.match((r) => r.url === url()).forEach((r) => r.flush(null, nao401));
    // Um segundo refresh com o token já rotacionado seria recusado e derrubaria a sessão.
    backend.expectOne(`${base}/api/v1/auth/refresh`).flush(parNovo);

    const repetidas = backend.match((r) => r.url === url());
    expect(repetidas).toHaveLength(4);
    repetidas.forEach((r) => {
      expect(r.request.headers.get('Authorization')).toBe('Bearer access.novo');
      r.flush({});
    });
    expect(recebidas.sort()).toEqual([0, 1, 2, 3]);
  });

  it('refresh recusado: encerra a sessão e leva ao login com o aviso', () => {
    let erro: { status?: number } | undefined;
    http.get(url()).subscribe({ error: (e) => (erro = e) });

    backend.expectOne(url()).flush(null, nao401);
    backend.expectOne(`${base}/api/v1/auth/refresh`).flush(null, nao401);

    expect(erro?.status).toBe(401);
    expect(TestBed.inject(Auth).isAuthenticated()).toBe(false);
    expect(storage.getRefreshToken()).toBeNull();
    expect(navegar).toHaveBeenCalledWith(['/login'], { queryParams: { sessao: 'expirada' } });
  });

  it('503 no refresh (cold start) não derruba a sessão', () => {
    http.get(url()).subscribe({ error: () => undefined });

    backend.expectOne(url()).flush(null, nao401);
    backend.expectOne(`${base}/api/v1/auth/refresh`).flush(null, { status: 503, statusText: 'Unavailable' });

    expect(TestBed.inject(Auth).isAuthenticated()).toBe(true);
    expect(storage.getRefreshToken()).toBe('refresh.valido');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('se a chamada repetida voltar 401 de novo, não entra em laço de refresh', () => {
    let erro: { status?: number } | undefined;
    http.get(url()).subscribe({ error: (e) => (erro = e) });

    backend.expectOne(url()).flush(null, nao401);
    backend.expectOne(`${base}/api/v1/auth/refresh`).flush(parNovo);
    backend.expectOne(url()).flush(null, nao401);

    backend.expectNone(`${base}/api/v1/auth/refresh`);
    expect(erro?.status).toBe(401);
  });
});
