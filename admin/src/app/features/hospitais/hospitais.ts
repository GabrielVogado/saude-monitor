import { Component, OnInit, inject, signal } from '@angular/core';
import { HospitalApi } from '../../core/hospitais/hospital';
import { Hospital, TipoEstabelecimento } from '../../core/hospitais/hospital.models';

@Component({
  selector: 'app-hospitais',
  imports: [],
  templateUrl: './hospitais.html',
  styleUrl: './hospitais.scss',
})
export class Hospitais implements OnInit {
  private readonly api = inject(HospitalApi);
  private readonly size = 20;

  protected readonly carregando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly hospitais = signal<Hospital[]>([]);
  protected readonly page = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly totalElements = signal(0);
  protected termoBusca = '';
  protected readonly tipoFiltro = signal<TipoEstabelecimento | ''>('');

  ngOnInit(): void {
    this.carregar();
  }

  protected buscar(termo: string): void {
    this.termoBusca = termo;
    this.page.set(0);
    this.carregar();
  }

  protected filtrarTipo(valor: string): void {
    this.tipoFiltro.set(valor === 'PUBLICO' || valor === 'PRIVADO' ? valor : '');
    this.page.set(0);
    this.carregar();
  }

  protected irPara(destino: number): void {
    if (destino < 0 || destino >= this.totalPages()) {
      return;
    }
    this.page.set(destino);
    this.carregar();
  }

  private carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);
    this.api
      .listar({
        busca: this.termoBusca,
        tipo: this.tipoFiltro() || undefined,
        page: this.page(),
        size: this.size,
      })
      .subscribe({
        next: (r) => {
          this.hospitais.set(r.content);
          this.totalPages.set(r.totalPages);
          this.totalElements.set(r.totalElements);
          this.carregando.set(false);
        },
        error: () => {
          this.erro.set('Não foi possível carregar os hospitais. Tente novamente.');
          this.carregando.set(false);
        },
      });
  }
}
