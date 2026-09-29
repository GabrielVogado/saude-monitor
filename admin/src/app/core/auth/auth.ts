import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, finalize, map, shareReplay, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AuthResponse, LoginRequest, RefreshRequest, Usuario } from './auth.models';
import { TokenStorage } from './token-storage';

/**
 * Erro de domínio: credenciais válidas, mas a conta não é ADMIN. O painel é
 * exclusivo de administradores — o app de campo faz o inverso (recusa ADMIN).
 */
export class AcessoNaoAdminError extends Error {
  constructor() {
    super('Esta conta não tem acesso administrativo.');
    this.name = 'AcessoNaoAdminError';
  }
}

/** Estado e operações de autenticação do painel administrativo. */
@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly storage = inject(TokenStorage);

  private readonly accessTokenSig = signal<string | null>(this.storage.getAccessToken());
  private readonly usuarioSig = signal<Usuario | null>(this.storage.getUsuario());
  /** Renovação em voo, compartilhada entre as chamadas que receberam 401 juntas. */
  private renovacaoEmCurso: Observable<string> | null = null;

  /** Usuário autenticado (ou `null`). */
  readonly usuario = this.usuarioSig.asReadonly();
  /** `true` enquanto houver access token em sessão. */
  readonly isAuthenticated = computed(() => this.accessTokenSig() !== null);

  /** Token para o interceptor anexar no cabeçalho `Authorization`. */
  get accessToken(): string | null {
    return this.accessTokenSig();
  }

  /**
   * Autentica no backend e — só se o usuário for ADMIN — persiste a sessão.
   * Um usuário válido porém não-ADMIN faz o fluxo lançar `AcessoNaoAdminError`
   * e **nenhum** token é guardado.
   */
  login(email: string, password: string): Observable<Usuario> {
    const corpo: LoginRequest = { email: email.trim(), password, rememberDevice: false };
    return this.http
      .post<AuthResponse>(`${this.apiBaseUrl}/api/v1/auth/login`, corpo)
      .pipe(
        map((resposta) => {
          if (resposta.usuario?.papel !== 'ADMIN') {
            throw new AcessoNaoAdminError();
          }
          this.persistir(resposta);
          return resposta.usuario;
        }),
      );
  }

  /**
   * Troca o refresh token por um novo par (o backend rotaciona e revoga o anterior) e
   * devolve o novo access token. O access token vive 15 min: sem isto, passado esse
   * tempo toda chamada recebia 401 e as telas ficavam vazias sem aviso.
   *
   * Chamadas simultâneas compartilham a mesma renovação: como o refresh anterior é
   * revogado na rotação, um segundo `POST /refresh` com ele seria recusado e derrubaria
   * a sessão que o primeiro acabou de renovar.
   */
  renovar(): Observable<string> {
    if (this.renovacaoEmCurso) {
      return this.renovacaoEmCurso;
    }
    const refreshToken = this.storage.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('Sessão sem refresh token.'));
    }
    const corpo: RefreshRequest = { refreshToken };
    this.renovacaoEmCurso = this.http
      .post<AuthResponse>(`${this.apiBaseUrl}/api/v1/auth/refresh`, corpo)
      .pipe(
        map((resposta) => {
          if (resposta.usuario?.papel !== 'ADMIN') {
            throw new AcessoNaoAdminError();
          }
          this.persistir(resposta);
          return resposta.accessToken;
        }),
        finalize(() => (this.renovacaoEmCurso = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.renovacaoEmCurso;
  }

  /** Encerra a sessão local. (Revogação do refresh no servidor entra em estória futura.) */
  logout(): void {
    this.storage.limpar();
    this.accessTokenSig.set(null);
    this.usuarioSig.set(null);
  }

  private persistir(resposta: AuthResponse): void {
    this.storage.salvar(resposta.accessToken, resposta.refreshToken, resposta.usuario);
    this.accessTokenSig.set(resposta.accessToken);
    this.usuarioSig.set(resposta.usuario);
  }
}
