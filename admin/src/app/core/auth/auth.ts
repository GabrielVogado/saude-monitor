import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, finalize, map, of, shareReplay } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AuthResponse, LoginRequest, Usuario } from './auth.models';
import { TokenStorage } from './token-storage';

/** Rotas de sessão do painel (ADR-013): o refresh vai e volta no cookie `HttpOnly`. */
export const ROTAS_SESSAO_PAINEL = {
  login: '/api/v1/auth/painel/login',
  refresh: '/api/v1/auth/painel/refresh',
  logout: '/api/v1/auth/painel/logout',
} as const;

/**
 * `withCredentials` para o navegador mandar e aceitar o cookie de refresh, e o cabeçalho
 * que o backend exige nessas rotas como defesa CSRF.
 */
const OPCOES_SESSAO = {
  withCredentials: true,
  headers: new HttpHeaders({ 'X-Requested-With': 'painel' }),
};

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

  private readonly usuarioSig = signal<Usuario | null>(this.storage.getUsuario());
  /** Renovação em voo, compartilhada entre as chamadas que receberam 401 juntas. */
  private renovacaoEmCurso: Observable<string> | null = null;

  /** Usuário autenticado (ou `null`). */
  readonly usuario = this.usuarioSig.asReadonly();
  /** `true` enquanto houver access token em memória. */
  readonly isAuthenticated = computed(() => this.storage.accessToken() !== null);

  /** Token para o interceptor anexar no cabeçalho `Authorization`. */
  get accessToken(): string | null {
    return this.storage.getAccessToken();
  }

  /**
   * Autentica no backend e — só se o usuário for ADMIN — guarda a sessão. O backend já
   * recusa conta de outro papel com 401; a conferência aqui é a segunda barreira.
   */
  login(email: string, password: string): Observable<Usuario> {
    const corpo: LoginRequest = { email: email.trim(), password, rememberDevice: false };
    return this.http
      .post<AuthResponse>(`${this.apiBaseUrl}${ROTAS_SESSAO_PAINEL.login}`, corpo, OPCOES_SESSAO)
      .pipe(map((resposta) => this.aceitar(resposta).usuario));
  }

  /**
   * Troca o refresh do cookie por um access token novo (o backend rotaciona o cookie e
   * revoga o anterior). O access token vive 15 min: sem isto, passado esse tempo toda
   * chamada recebia 401 e as telas ficavam vazias sem aviso.
   *
   * Chamadas simultâneas compartilham a mesma renovação: como o refresh anterior é
   * revogado na rotação, um segundo `POST /refresh` com ele seria recusado e derrubaria
   * a sessão que o primeiro acabou de renovar.
   */
  renovar(): Observable<string> {
    if (this.renovacaoEmCurso) {
      return this.renovacaoEmCurso;
    }
    this.renovacaoEmCurso = this.http
      .post<AuthResponse>(`${this.apiBaseUrl}${ROTAS_SESSAO_PAINEL.refresh}`, null, OPCOES_SESSAO)
      .pipe(
        map((resposta) => this.aceitar(resposta).accessToken),
        finalize(() => (this.renovacaoEmCurso = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.renovacaoEmCurso;
  }

  /**
   * Recupera a sessão ao abrir ou recarregar a aba: o access token estava só em memória,
   * mas o cookie de refresh continua no navegador. Emite `true` com a sessão de volta e
   * `false` sem ela (sem cookie, cookie vencido ou backend fora do ar).
   */
  restaurarSessao(): Observable<boolean> {
    if (this.isAuthenticated()) {
      return of(true);
    }
    return this.renovar().pipe(
      map(() => true),
      catchError(() => {
        this.limparLocal();
        return of(false);
      }),
    );
  }

  /**
   * Encerra a sessão: limpa a memória na hora e pede ao backend que revogue o refresh e
   * apague o cookie. A chamada é best-effort: sem rede, a sessão local já acabou e o
   * refresh vence sozinho.
   */
  logout(): void {
    this.limparLocal();
    this.http
      .post(`${this.apiBaseUrl}${ROTAS_SESSAO_PAINEL.logout}`, null, OPCOES_SESSAO)
      .subscribe({ error: () => undefined });
  }

  private aceitar(resposta: AuthResponse): AuthResponse {
    if (resposta.usuario?.papel !== 'ADMIN') {
      throw new AcessoNaoAdminError();
    }
    this.storage.salvar(resposta.accessToken, resposta.usuario);
    this.usuarioSig.set(resposta.usuario);
    return resposta;
  }

  private limparLocal(): void {
    this.storage.limpar();
    this.usuarioSig.set(null);
  }
}
