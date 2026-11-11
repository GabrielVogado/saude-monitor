import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { Auth } from './auth';

/**
 * Bloqueia rotas protegidas. Sem access token em memória (aba recém-aberta ou recarregada),
 * tenta recuperar a sessão pelo cookie de refresh antes de mandar ao `/login`.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return true;
  }
  return auth.restaurarSessao().pipe(map((ok) => (ok ? true : router.createUrlTree(['/login']))));
};
