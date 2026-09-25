import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../../core/auth/auth';

/** Layout do painel: topbar + navegação lateral + área de conteúdo (router-outlet). */
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

  protected sair(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
