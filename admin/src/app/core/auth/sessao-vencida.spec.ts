import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
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
  const parNovo = { accessToken: 'access.novo', expiraEm: 900, usuario };
  const nao401 = { status: 401, statusText: 'Unauthorized' };

  beforeEach(() => {
    try {
      sessionStorage.clear();
    } catch {
      /* jsdom sem storage */
    }
    TestBed.configureTestingModule({ providers: [...appConfig.providers, provideHttpClientTesting()] });
    storage = TestBed.inject(TokenStorage);
    // Sessão de um login feito há mais de 15 min: o access token já não vale. O refresh
    // está no cookie HttpOnly, que o navegador manda sozinho e o teste não enxerga.
    storage.salvar('access.vencido', usuario);

    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    base = TestBed.inject(API_BASE_URL);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => backend.verify());

  const url = () => `${base}/api/v1/admin/hospitais`;
  const refreshUrl = () => `${base}/api/v1/auth/painel/refresh`;

  it('401 por token vencido: renova, repete a chamada e entrega os dados', () => {
    let resposta: unknown;
    http.get(url()).subscribe((r) => (resposta = r));

    const primeira = backend.expectOne(url());
    expect(primeira.request.headers.get('Authorization')).toBe('Bearer access.vencido');
    primeira.flush({ message: 'expirado' }, nao401);

    const refresh = backend.expectOne(refreshUrl());
    expect(refresh.request.body).toBeNull();
    expect(refresh.request.withCredentials).toBe(true);
    expect(refresh.request.headers.get('X-Requested-With')).toBe('painel');
    refresh.flush(parNovo);

    const repetida = backend.expectOne(url());
    expect(repetida.request.headers.get('Authorization')).toBe('Bearer access.novo');
    repetida.flush({ content: [{ id: 'h1' }], totalElements: 340 });

    expect(resposta).toEqual({ content: [{ id: 'h1' }], totalElements: 340 });
    expect(storage.getAccessToken()).toBe('access.novo');
    expect(sessionStorage.getItem('admin.usuario')).not.toContain('access');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('as 4 páginas do mapa vencendo juntas disparam um único refresh', () => {
    const recebidas: number[] = [];
    for (let pagina = 0; pagina < 4; pagina++) {
      http.get(url(), { params: { page: pagina } }).subscribe(() => recebidas.push(pagina));
    }

    backend.match((r) => r.url === url()).forEach((r) => r.flush(null, nao401));
    // Um segundo refresh com o token já rotacionado seria recusado e derrubaria a sessão.
    backend.expectOne(refreshUrl()).flush(parNovo);

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
    backend.expectOne(refreshUrl()).flush(null, nao401);
    // Encerrar a sessão também pede ao backend que apague o cookie.
    backend.expectOne(`${base}/api/v1/auth/painel/logout`).flush({ success: true });

    expect(erro?.status).toBe(401);
    expect(TestBed.inject(Auth).isAuthenticated()).toBe(false);
    expect(storage.getAccessToken()).toBeNull();
    expect(navegar).toHaveBeenCalledWith(['/login'], { queryParams: { sessao: 'expirada' } });
  });

  it('503 no refresh (cold start) não derruba a sessão', () => {
    http.get(url()).subscribe({ error: () => undefined });

    backend.expectOne(url()).flush(null, nao401);
    backend.expectOne(refreshUrl()).flush(null, { status: 503, statusText: 'Unavailable' });

    expect(TestBed.inject(Auth).isAuthenticated()).toBe(true);
    expect(storage.getAccessToken()).toBe('access.vencido');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('se a chamada repetida voltar 401 de novo, não entra em laço de refresh', () => {
    let erro: { status?: number } | undefined;
    http.get(url()).subscribe({ error: (e) => (erro = e) });

    backend.expectOne(url()).flush(null, nao401);
    backend.expectOne(refreshUrl()).flush(parNovo);
    backend.expectOne(url()).flush(null, nao401);

    backend.expectNone(refreshUrl());
    expect(erro?.status).toBe(401);
  });

  describe('aba recarregada', () => {
    beforeEach(() => {
      // Recarregar a aba apaga a memória: sobra o usuário no sessionStorage e o cookie.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [...appConfig.providers, provideHttpClientTesting()] });
      sessionStorage.setItem('admin.usuario', JSON.stringify(usuario));
      backend = TestBed.inject(HttpTestingController);
      base = TestBed.inject(API_BASE_URL);
    });

    /** A navegação carrega a rota e roda o guard em ticks seguintes: espera o refresh sair. */
    async function aguardarRefresh(): Promise<TestRequest> {
      for (let tentativa = 0; tentativa < 50; tentativa++) {
        const pedidos = backend.match(refreshUrl());
        if (pedidos.length > 0) {
          expect(pedidos).toHaveLength(1);
          return pedidos[0];
        }
        await new Promise((resolver) => setTimeout(resolver, 0));
      }
      throw new Error('O guard não pediu o refresh da sessão.');
    }

    it('recupera a sessão pelo cookie e abre a rota protegida', async () => {
      const router = TestBed.inject(Router);
      expect(TestBed.inject(Auth).isAuthenticated()).toBe(false);

      const navegacao = router.navigateByUrl('/hospitais');
      const refresh = await aguardarRefresh();
      expect(refresh.request.withCredentials).toBe(true);
      refresh.flush(parNovo);

      expect(await navegacao).toBe(true);
      expect(router.url).toBe('/hospitais');
      expect(TestBed.inject(Auth).accessToken).toBe('access.novo');
      expect(Object.keys(sessionStorage)).toEqual(['admin.usuario']);
    });

    it('sem cookie válido, leva ao login', async () => {
      const router = TestBed.inject(Router);

      const navegacao = router.navigateByUrl('/hospitais');
      (await aguardarRefresh()).flush(null, nao401);
      await navegacao;

      expect(router.url).toBe('/login');
      expect(sessionStorage.getItem('admin.usuario')).toBeNull();
    });
  });
});
