import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HospitalApi } from '../../core/hospitais/hospital';
import { HospitalDetalheResponse } from '../../core/hospitais/hospital.models';

/**
 * Detalhe somente-leitura do hospital (E7-05 — ir ao detalhe via mapa/lista), com o
 * atalho para a edição (E7-06, `/hospitais/:id/editar`). Os indicadores continuam só
 * leitura aqui (E7-08).
 */
@Component({
  selector: 'app-hospital-detalhe',
  imports: [RouterLink],
  templateUrl: './hospital-detalhe.html',
  styleUrl: './hospital-detalhe.scss',
})
export class HospitalDetalhe implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(HospitalApi);

  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly hospital = signal<HospitalDetalheResponse | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.erro.set('Hospital não informado.');
      this.carregando.set(false);
      return;
    }
    this.api.buscarPorId(id).subscribe({
      next: (h) => {
        this.hospital.set(h);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar este hospital. Ele pode ter sido removido.');
        this.carregando.set(false);
      },
    });
  }
}
