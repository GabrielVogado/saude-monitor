import { Component, inject } from '@angular/core';
import { Auth } from '../../core/auth/auth';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly auth = inject(Auth);

  protected readonly usuario = this.auth.usuario;

  /** Cartões da visão geral — valores reais entram na integração das próximas estórias. */
  protected readonly cards = [
    { titulo: 'Hospitais cadastrados', nota: 'disponível na E7-02' },
    { titulo: 'Sugestões pendentes', nota: 'disponível na E7-09' },
    { titulo: 'Feedbacks (90 dias)', nota: 'disponível em breve' },
  ] as const;
}
