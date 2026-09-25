import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth/auth';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly usuario = this.auth.usuario;

  /** Inicial do nome para o avatar do topo. */
  protected readonly inicial = computed(() => (this.usuario()?.nome?.trim()?.[0] ?? '?').toUpperCase());

  /** Itens de navegação das próximas estórias (ainda não navegáveis). */
  protected readonly navFuturo = ['Hospitais', 'Mapa', 'Sugestões'] as const;

  /** Cartões da visão geral — valores reais entram quando os endpoints forem integrados. */
  protected readonly cards = [
    { titulo: 'Hospitais cadastrados', nota: 'disponível na E7-02' },
    { titulo: 'Sugestões pendentes', nota: 'disponível na E7-09' },
    { titulo: 'Feedbacks (90 dias)', nota: 'disponível em breve' },
  ] as const;

  protected sair(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
