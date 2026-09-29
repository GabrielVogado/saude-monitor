import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Auth } from './auth';

/** Rotas de autenticação: um 401 nelas é resposta do fluxo, não sessão vencida. */
const ROTAS_AUTH = ['/api/v1/auth/login', '/api/v1/auth/refresh'];

function comToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Anexa `Authorization: Bearer <token>` apenas nas chamadas à nossa API e apenas
 * quando há token — nunca vaza o token para terceiros (ex. tiles de mapa, CDNs).
 *
 * Quando a API responde 401 (access token de 15 min vencido), renova a sessão com o
 * refresh token e repete a chamada uma vez. Se a renovação falhar, encerra a sessão e
 * leva ao login — antes, o painel seguia "logado" com todas as telas vazias.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const apiBaseUrl = inject(API_BASE_URL);
  const token = auth.accessToken;

  if (!token || !req.url.startsWith(apiBaseUrl)) {
    return next(req);
  }
  if (ROTAS_AUTH.some((rota) => req.url.startsWith(`${apiBaseUrl}${rota}`))) {
    return next(req);
  }

  return next(comToken(req, token)).pipe(
    catchError((erro: unknown) => {
      if (!(erro instanceof HttpErrorResponse) || erro.status !== 401) {
        return throwError(() => erro);
      }
      return auth.renovar().pipe(
        catchError((falhaRenovacao: unknown) => {
          // Rede fora ou 5xx (ex.: 503 do cold start do Cloud Run) não provam que a sessão
          // acabou: a chamada falha, mas a sessão fica para a próxima tentativa.
          if (
            falhaRenovacao instanceof HttpErrorResponse &&
            falhaRenovacao.status !== 401 &&
            falhaRenovacao.status !== 403
          ) {
            return throwError(() => falhaRenovacao);
          }
          auth.logout();
          router.navigate(['/login'], { queryParams: { sessao: 'expirada' } });
          return throwError(() => erro);
        }),
        switchMap((novoToken) => next(comToken(req, novoToken))),
      );
    }),
  );
};
