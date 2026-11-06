import { TestBed } from '@angular/core/testing';
import { CanActivateFn, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, isObservable, of } from 'rxjs';

import { authGuard } from './auth-guard';
import { Auth } from './auth';

describe('authGuard', () => {
  const run: CanActivateFn = (...p) => TestBed.runInInjectionContext(() => authGuard(...p));
  const auth = { isAuthenticated: vi.fn(), restaurarSessao: vi.fn() };

  beforeEach(() => {
    auth.isAuthenticated.mockReset();
    auth.restaurarSessao.mockReset();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Auth, useValue: auth }],
    });
  });

  async function resultado(): Promise<unknown> {
    const res = run({} as never, {} as never);
    return isObservable(res) ? firstValueFrom(res as Observable<unknown>) : res;
  }

  it('libera a rota quando autenticado, sem tentar recuperar a sessão', async () => {
    auth.isAuthenticated.mockReturnValue(true);
    expect(await resultado()).toBe(true);
    expect(auth.restaurarSessao).not.toHaveBeenCalled();
  });

  it('aba recarregada: recupera a sessão pelo cookie e libera a rota', async () => {
    auth.isAuthenticated.mockReturnValue(false);
    auth.restaurarSessao.mockReturnValue(of(true));
    expect(await resultado()).toBe(true);
  });

  it('redireciona para /login quando não há sessão a recuperar', async () => {
    auth.isAuthenticated.mockReturnValue(false);
    auth.restaurarSessao.mockReturnValue(of(false));
    const res = await resultado();
    expect(res).toBeInstanceOf(UrlTree);
    expect((res as UrlTree).toString()).toBe('/login');
  });
});
