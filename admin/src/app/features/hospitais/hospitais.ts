import { Component, OnInit, inject, signal } from '@angular/core';
import { HospitalApi } from '../../core/hospitais/hospital';
import { Hospital, StatusHospital, TipoEstabelecimento } from '../../core/hospitais/hospital.models';

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
  protected readonly statusFiltro = signal<StatusHospital>('TODOS');
  /** Id do hospital cujo status está sendo alterado (desabilita o botão da linha). */
  protected readonly alterandoId = signal<string | null>(null);
  /** Erro de ação (toggle) — mostrado como aviso, sem esconder a tabela. */
  protected readonly erroAcao = signal<string | null>(null);

  ngOnInit(): void {
    this.carregar();
  }

  /** Ativa/desativa o hospital (E7-07), com confirmação, e recarrega a listagem. */
  protected alternarStatus(h: Hospital): void {
    const acao = h.ativo ? 'desativar' : 'ativar';
    if (!confirm(`Deseja ${acao} o hospital "${h.nome}"?`)) {
      return;
    }
    this.alterandoId.set(h.id);
    this.erroAcao.set(null);
    this.api.alterarStatus(h.id, !h.ativo).subscribe({
      next: () => {
        this.alterandoId.set(null);
        this.carregar();
      },
      error: () => {
        this.alterandoId.set(null);
        this.erroAcao.set(`Não foi possível ${acao} o hospital. Tente novamente.`);
      },
    });
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

  protected filtrarStatus(valor: string): void {
    this.statusFiltro.set(valor === 'ATIVOS' || valor === 'INATIVOS' ? valor : 'TODOS');
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
        status: this.statusFiltro(),
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
