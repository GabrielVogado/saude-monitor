import { TestBed } from '@angular/core/testing';
import { HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';

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
