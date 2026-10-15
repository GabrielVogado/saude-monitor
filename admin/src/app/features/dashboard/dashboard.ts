import { Component, OnInit, inject, signal } from '@angular/core';
import { Auth } from '../../core/auth/auth';
import { HospitalApi } from '../../core/hospitais/hospital';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly auth = inject(Auth);
  private readonly api = inject(HospitalApi);

  protected readonly usuario = this.auth.usuario;

  /** Total de hospitais (ativos + inativos) — KPI real da E7-02. `null` = indisponível. */
  protected readonly totalHospitais = signal<number | null>(null);
  protected readonly carregandoTotal = signal(true);

  /** Cartões ainda sem fonte de dado — mostrados como "em breve". */
  protected readonly cardsPendentes = [
    { titulo: 'Sugestões pendentes', nota: 'em breve' },
    { titulo: 'Feedbacks (90 dias)', nota: 'em breve' },
  ] as const;

  ngOnInit(): void {
    this.api.listar({ status: 'TODOS', size: 1 }).subscribe({
      next: (r) => {
        this.totalHospitais.set(r.totalElements);
        this.carregandoTotal.set(false);
      },
      error: () => {
        // mantém null → o card mostra "—" em vez de um número inventado
        this.carregandoTotal.set(false);
      },
    });
  }
}
