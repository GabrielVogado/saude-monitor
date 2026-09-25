import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Auth } from '../../core/auth/auth';

/**
 * Layout do painel: topbar + navegação lateral + área de conteúdo (router-outlet).
 *
 * A navegação lateral é fixa em telas ≥768px (`md:`) e vira um menu tipo drawer,
 * acionado pelo botão hamburger da topbar, abaixo disso — sem esse controle o menu
 * simplesmente desaparecia em janelas estreitas (bug relatado pelo PO, 25/09/2026).
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly usuario = this.auth.usuario;
  protected readonly inicial = computed(() => (this.usuario()?.nome?.trim()?.[0] ?? '?').toUpperCase());

  /** Visibilidade do menu lateral em telas estreitas (drawer). Fechado por padrão. */
  protected readonly menuAberto = signal(false);

  constructor() {
    // Fecha o drawer automaticamente ao navegar (clique num link, ou back/forward).
    // `takeUntilDestroyed`: o Router é singleton e sobrevive ao componente — sem isto,
    // cada logout/login (que destrói e recria o Shell) deixava uma subscription órfã.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuAberto.set(false));
  }

  protected alternarMenu(): void {
    this.menuAberto.update((v) => !v);
  }

  protected fecharMenu(): void {
    this.menuAberto.set(false);
  }

  protected sair(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
