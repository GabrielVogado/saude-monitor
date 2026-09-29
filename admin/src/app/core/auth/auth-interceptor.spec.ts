import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { authInterceptor } from './auth-interceptor';
import { Auth } from './auth';
import { API_BASE_URL } from '../config/api.config';

const BASE = 'https://api.test';

function rodar(req: HttpRequest<unknown>): HttpRequest<unknown> {
  let visto: HttpRequest<unknown> | null = null;
  const next: HttpHandlerFn = (r) => {
    visto = r;
    return of(new HttpResponse());
  };
  TestBed.runInInjectionContext(() => authInterceptor(req, next).subscribe());
  return visto!;
}

describe('authInterceptor', () => {
  it('anexa Bearer nas chamadas à API quando há token', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: { accessToken: 'tok-123' } },
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
    const req = rodar(new HttpRequest('GET', `${BASE}/api/v1/hospitais`));
    expect(req.headers.get('Authorization')).toBe('Bearer tok-123');
  });

  it('não anexa o token em URLs de terceiros', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: { accessToken: 'tok-123' } },
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
    const req = rodar(new HttpRequest('GET', 'https://tiles.example.com/1.png'));
    expect(req.headers.has('Authorization')).toBe(false);
  });

  it('não anexa quando não há token', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: { accessToken: null } },
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
    const req = rodar(new HttpRequest('GET', `${BASE}/api/v1/hospitais`));
    expect(req.headers.has('Authorization')).toBe(false);
  });
});

describe('authInterceptor — sessão vencida', () => {
  const erro401 = () => new HttpErrorResponse({ status: 401, url: `${BASE}/api/v1/hospitais` });

  function configurar(renovar: () => Observable<string>) {
    const auth = { accessToken: 'velho', renovar: vi.fn(renovar), logout: vi.fn() };
    const router = { navigate: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: auth },
        { provide: Router, useValue: router },
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
    return { auth, router };
  }

  function executar(req: HttpRequest<unknown>, next: HttpHandlerFn) {
    let resposta: unknown;
    let erro: unknown;
    TestBed.runInInjectionContext(() =>
      authInterceptor(req, next).subscribe({ next: (r) => (resposta = r), error: (e) => (erro = e) }),
    );
    return { resposta: () => resposta, erro: () => erro };
  }

  it('no 401 renova a sessão e repete a chamada com o token novo', () => {
    const { auth, router } = configurar(() => of('novo'));
    const vistos: (string | null)[] = [];
    const next: HttpHandlerFn = (r) => {
      vistos.push(r.headers.get('Authorization'));
      return vistos.length === 1 ? throwError(() => erro401()) : of(new HttpResponse({ status: 200 }));
    };

    const r = executar(new HttpRequest('GET', `${BASE}/api/v1/hospitais`), next);

    expect(vistos).toEqual(['Bearer velho', 'Bearer novo']);
    expect(auth.renovar).toHaveBeenCalledTimes(1);
    expect((r.resposta() as HttpResponse<unknown>).status).toBe(200);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('se a renovação falhar, encerra a sessão e leva ao login com o aviso', () => {
    const { auth, router } = configurar(() => throwError(() => new Error('refresh recusado')));
    const next: HttpHandlerFn = () => throwError(() => erro401());

    const r = executar(new HttpRequest('GET', `${BASE}/api/v1/hospitais`), next);

    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { sessao: 'expirada' } });
    expect((r.erro() as HttpErrorResponse).status).toBe(401);
  });

  it('se o refresh for recusado (401), encerra a sessão', () => {
    const { auth } = configurar(() => throwError(() => new HttpErrorResponse({ status: 401 })));
    executar(new HttpRequest('GET', `${BASE}/api/v1/hospitais`), () => throwError(() => erro401()));
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it('falha de rede ou 5xx na renovação não derruba a sessão (ex.: cold start)', () => {
    const { auth, router } = configurar(() => throwError(() => new HttpErrorResponse({ status: 503 })));

    const r = executar(new HttpRequest('GET', `${BASE}/api/v1/hospitais`), () => throwError(() => erro401()));

    expect(auth.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect((r.erro() as HttpErrorResponse).status).toBe(503);
  });

  it('erros que não são 401 passam direto, sem renovar', () => {
    const { auth } = configurar(() => of('novo'));
    const next: HttpHandlerFn = () => throwError(() => new HttpErrorResponse({ status: 403 }));

    const r = executar(new HttpRequest('GET', `${BASE}/api/v1/hospitais`), next);

    expect(auth.renovar).not.toHaveBeenCalled();
    expect((r.erro() as HttpErrorResponse).status).toBe(403);
  });

  it('401 do próprio login ou refresh não dispara renovação (sem laço)', () => {
    const { auth } = configurar(() => of('novo'));
    const next: HttpHandlerFn = () => throwError(() => erro401());

    executar(new HttpRequest('POST', `${BASE}/api/v1/auth/refresh`, {}), next);
    executar(new HttpRequest('POST', `${BASE}/api/v1/auth/login`, {}), next);

    expect(auth.renovar).not.toHaveBeenCalled();
  });
});
