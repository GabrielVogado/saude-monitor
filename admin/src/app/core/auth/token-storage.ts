import { Injectable } from '@angular/core';
import { Usuario } from './auth.models';

const CHAVE = {
  access: 'admin.accessToken',
  refresh: 'admin.refreshToken',
  usuario: 'admin.usuario',
} as const;

/**
 * Persistência da sessão do painel em `sessionStorage` (escopo da aba; limpa ao
 * fechar). Todo acesso é protegido por try/catch — em janela privada ou com storage
 * bloqueado, os métodos degradam para "sem sessão" em vez de lançar.
 *
 * NOTA DE SEGURANÇA (ver ADR-012): guardar JWT em web storage é exposto a XSS. É uma
 * escolha consciente de primeira fatia; endurecer (refresh em cookie httpOnly) exige
 * mudança no backend e fica para estória de hardening do E7.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  getAccessToken(): string | null {
    return this.ler(CHAVE.access);
  }

  getRefreshToken(): string | null {
    return this.ler(CHAVE.refresh);
  }

  getUsuario(): Usuario | null {
    const bruto = this.ler(CHAVE.usuario);
    if (!bruto) {
      return null;
    }
    try {
      return JSON.parse(bruto) as Usuario;
    } catch {
      return null;
    }
  }

  salvar(accessToken: string, refreshToken: string, usuario: Usuario): void {
    this.escrever(CHAVE.access, accessToken);
    this.escrever(CHAVE.refresh, refreshToken);
    this.escrever(CHAVE.usuario, JSON.stringify(usuario));
  }

  limpar(): void {
    for (const chave of Object.values(CHAVE)) {
      this.remover(chave);
    }
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
      /* storage indisponível: sessão vira apenas em memória nesta aba */
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
