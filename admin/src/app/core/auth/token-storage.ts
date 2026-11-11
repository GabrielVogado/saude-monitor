import { Injectable, signal } from '@angular/core';
import { Usuario } from './auth.models';

const CHAVE_USUARIO = 'admin.usuario';
/** Onde versões anteriores do painel guardavam os tokens; apagadas ao abrir. */
const CHAVES_DE_TOKEN_ANTIGAS = ['admin.accessToken', 'admin.refreshToken'];

/**
 * Sessão do painel (ADR-013). O access token fica só em memória, num signal: some ao
 * recarregar ou fechar a aba e nunca vai para o web storage, onde um XSS o leria. O refresh
 * token nem passa pelo JavaScript: o backend o guarda no cookie `HttpOnly`
 * `__Host-painel_refresh`, e a sessão volta ao abrir a aba por `POST /auth/painel/refresh`.
 *
 * No `sessionStorage` fica só o usuário (nome, e-mail e papel, que não dão acesso a nada).
 * Todo acesso ao storage é protegido por try/catch — em janela privada ou com storage
 * bloqueado, os métodos degradam em vez de lançar.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  private readonly accessTokenSig = signal<string | null>(null);

  /** Access token da sessão, em memória (`null` sem sessão). */
  readonly accessToken = this.accessTokenSig.asReadonly();

  constructor() {
    for (const chave of CHAVES_DE_TOKEN_ANTIGAS) {
      this.remover(chave);
    }
  }

  getAccessToken(): string | null {
    return this.accessTokenSig();
  }

  getUsuario(): Usuario | null {
    const bruto = this.ler(CHAVE_USUARIO);
    if (!bruto) {
      return null;
    }
    try {
      return JSON.parse(bruto) as Usuario;
    } catch {
      return null;
    }
  }

  salvar(accessToken: string, usuario: Usuario): void {
    this.accessTokenSig.set(accessToken);
    this.escrever(CHAVE_USUARIO, JSON.stringify(usuario));
  }

  limpar(): void {
    this.accessTokenSig.set(null);
    this.remover(CHAVE_USUARIO);
  }

  private ler(chave: string): string | null {
    try {
      return sessionStorage.getItem(chave);
    } catch {
      return null;
    }
  }

  private escrever(chave: string, valor: string): void {
    try {
      sessionStorage.setItem(chave, valor);
    } catch {
      /* storage indisponível: o nome do usuário não sobrevive ao recarregar */
    }
  }

  private remover(chave: string): void {
    try {
      sessionStorage.removeItem(chave);
    } catch {
      /* ignore */
    }
  }
}
