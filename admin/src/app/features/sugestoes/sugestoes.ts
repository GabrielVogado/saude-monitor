import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription } from 'rxjs';
import { RouterLink } from '@angular/router';
import { HospitalApi } from '../../core/hospitais/hospital';
import { Endereco, Hospital } from '../../core/hospitais/hospital.models';
import { SugestaoApi } from '../../core/sugestoes/sugestao';
import {
  MOTIVO_RECUSA_MAX,
  MOTIVO_RECUSA_MIN,
  StatusSugestao,
  Sugestao,
} from '../../core/sugestoes/sugestao.models';

/** Painel aberto sob uma sugestão pendente: vincular a hospital (aprovar) ou recusar. */
type Acao = { id: string; tipo: 'aprovar' | 'recusar' };

/**
 * Fila de moderação de sugestões de hospital (E1-06), aberta pelo item "Sugestões" do
 * menu (E7-09). Substitui a tela mobile removida em 08/09/2026.
 *
 * Aprovar não cria hospital: o backend exige o `hospitalId` de um estabelecimento já
 * cadastrado, ao qual a sugestão fica vinculada. Por isso a aprovação passa por uma busca
 * no cadastro (endpoint admin, que inclui inativos), já preenchida com o nome sugerido.
 */
@Component({
  selector: 'app-sugestoes',
  imports: [DatePipe, RouterLink],
  templateUrl: './sugestoes.html',
  styleUrl: './sugestoes.scss',
})
export class Sugestoes implements OnInit {
  private readonly api = inject(SugestaoApi);
  private readonly hospitalApi = inject(HospitalApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly size = 20;

  protected readonly motivoMin = MOTIVO_RECUSA_MIN;
  protected readonly motivoMax = MOTIVO_RECUSA_MAX;

  protected readonly statusFiltro = signal<StatusSugestao | null>('PENDENTE');
  protected readonly carregando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly sugestoes = signal<Sugestao[]>([]);
  protected readonly page = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly totalElements = signal(0);

  protected readonly acao = signal<Acao | null>(null);
  protected readonly enviando = signal(false);
  protected readonly erroAcao = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  // Aprovar: busca de hospital para vincular.
  protected readonly termoHospital = signal('');
  protected readonly buscandoHospitais = signal(false);
  protected readonly hospitaisEncontrados = signal<Hospital[] | null>(null);
  /** Busca em andamento: uma nova busca cancela a anterior, para a resposta velha não sobrescrever a nova. */
  private buscaHospitais?: Subscription;

  // Recusar: motivo.
  protected readonly motivo = signal('');
  protected readonly motivoValido = computed(() => {
    const n = this.motivo().trim().length;
    return n >= MOTIVO_RECUSA_MIN && n <= MOTIVO_RECUSA_MAX;
  });

  ngOnInit(): void {
    this.carregar();
  }

  protected filtrarStatus(valor: string): void {
    this.statusFiltro.set(valor === 'APROVADA' || valor === 'RECUSADA' || valor === 'PENDENTE' ? valor : null);
    this.page.set(0);
    this.fecharAcao();
    this.carregar();
  }

  protected irPara(destino: number): void {
    if (destino < 0 || destino >= this.totalPages()) {
      return;
    }
    this.page.set(destino);
    this.fecharAcao();
    this.carregar();
  }

  protected abrirAprovar(s: Sugestao): void {
    this.acao.set({ id: s.id, tipo: 'aprovar' });
    this.erroAcao.set(null);
    this.aviso.set(null);
    this.termoHospital.set(s.nome);
    this.hospitaisEncontrados.set(null);
    this.buscarHospitais();
  }

  protected abrirRecusar(s: Sugestao): void {
    this.acao.set({ id: s.id, tipo: 'recusar' });
    this.erroAcao.set(null);
    this.aviso.set(null);
    this.motivo.set('');
  }

  protected fecharAcao(): void {
    this.acao.set(null);
    this.erroAcao.set(null);
  }

  protected buscarHospitais(): void {
    const termo = this.termoHospital().trim();
    this.buscaHospitais?.unsubscribe();
    if (!termo) {
      this.hospitaisEncontrados.set([]);
      return;
    }
    this.buscandoHospitais.set(true);
    this.buscaHospitais = this.hospitalApi
      .listar({ busca: termo, status: 'TODOS', page: 0, size: 5 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.hospitaisEncontrados.set(r.content);
          this.buscandoHospitais.set(false);
        },
        error: () => {
          this.hospitaisEncontrados.set([]);
          this.buscandoHospitais.set(false);
          this.erroAcao.set('Não foi possível buscar hospitais. Tente novamente.');
        },
      });
  }

  protected vincular(s: Sugestao, h: Hospital): void {
    if (!confirm(`Aprovar a sugestão "${s.nome}" vinculando-a ao hospital "${h.nome}"?`)) {
      return;
    }
    this.executar(s, this.api.aprovar(s.id, h.id), `Sugestão "${s.nome}" aprovada e vinculada a "${h.nome}".`);
  }

  protected recusar(s: Sugestao): void {
    if (!this.motivoValido()) {
      return;
    }
    this.executar(s, this.api.rejeitar(s.id, this.motivo().trim()), `Sugestão "${s.nome}" recusada.`);
  }

  protected enderecoResumido(e: Endereco | null | undefined): string {
    if (!e) {
      return '—';
    }
    const rua = [e.logradouro, e.numero].filter(Boolean).join(', ');
    const cidade = [e.cidade, e.uf].filter(Boolean).join('/');
    return [rua, e.bairro, cidade].filter(Boolean).join(' · ') || '—';
  }

  private executar(s: Sugestao, chamada: Observable<Sugestao>, sucesso: string): void {
    this.enviando.set(true);
    this.erroAcao.set(null);
    chamada.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.enviando.set(false);
        this.acao.set(null);
        this.aviso.set(sucesso);
        this.carregar();
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        if (e instanceof HttpErrorResponse && e.status === 409) {
          // Outro admin revisou antes: a fila está velha. Recarrega e explica.
          this.acao.set(null);
          this.aviso.set(`A sugestão "${s.nome}" já tinha sido revisada. A lista foi atualizada.`);
          this.carregar();
          return;
        }
        if (e instanceof HttpErrorResponse && e.status === 404) {
          this.erroAcao.set('O hospital escolhido não existe mais. Busque outro.');
          return;
        }
        this.erroAcao.set('Não foi possível concluir a ação. Tente novamente.');
      },
    });
  }

  private carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);
    this.api
      .listar(this.statusFiltro(), this.page(), this.size)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          // Aprovar/recusar o último item da última página a esvazia: volta uma página.
          if (r.content.length === 0 && this.page() > 0) {
            this.page.update((p) => p - 1);
            this.carregar();
            return;
          }
          this.sugestoes.set(r.content);
          this.totalPages.set(r.totalPages);
          this.totalElements.set(r.totalElements);
          this.carregando.set(false);
        },
        error: () => {
          this.erro.set('Não foi possível carregar as sugestões. Tente novamente.');
          this.carregando.set(false);
        },
      });
  }
}
