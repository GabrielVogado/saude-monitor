import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from '../config/api.config';
import { Auth } from './auth';

/**
 * Anexa `Authorization: Bearer <token>` apenas nas chamadas à nossa API e apenas
 * quando há token — nunca vaza o token para terceiros (ex. tiles de mapa, CDNs).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(Auth).accessToken;
  const apiBaseUrl = inject(API_BASE_URL);

  if (token && req.url.startsWith(apiBaseUrl)) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
  return next(req);
};
