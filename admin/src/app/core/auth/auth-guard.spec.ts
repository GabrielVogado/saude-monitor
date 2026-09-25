import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router, UrlTree, provideRouter } from '@angular/router';

import { authGuard } from './auth-guard';
import { Auth } from './auth';

describe('authGuard', () => {
  const run: CanActivateFn = (...p) => TestBed.runInInjectionContext(() => authGuard(...p));
  const auth = { isAuthenticated: vi.fn() };

  beforeEach(() => {
    auth.isAuthenticated.mockReset();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Auth, useValue: auth }],
    });
  });

  it('libera a rota quando autenticado', () => {
    auth.isAuthenticated.mockReturnValue(true);
    expect(run({} as never, {} as never)).toBe(true);
  });

  it('redireciona para /login quando não autenticado', () => {
    auth.isAuthenticated.mockReturnValue(false);
    const res = run({} as never, {} as never);
    expect(res).toBeInstanceOf(UrlTree);
    expect((res as UrlTree).toString()).toBe('/login');
  });
});
