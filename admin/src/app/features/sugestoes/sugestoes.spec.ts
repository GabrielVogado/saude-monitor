import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Sugestoes } from './sugestoes';
import { HospitalApi } from '../../core/hospitais/hospital';
import { SugestaoApi } from '../../core/sugestoes/sugestao';
import { Sugestao } from '../../core/sugestoes/sugestao.models';

function sugestao(over: Partial<Sugestao> = {}): Sugestao {
  return {
    id: 's1',
    nome: 'UBS Nova',
    endereco: { logradouro: 'QR 100', cidade: 'Brasília', uf: 'DF' },
    observacao: 'Abriu mês passado',
    status: 'PENDENTE',
    criadoEm: '2026-09-20T12:00:00Z',
    ...over,
  };
}

function pagina(content: Sugestao[], over: Record<string, unknown> = {}) {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages: content.length ? 1 : 0, ...over };
}

describe('Sugestoes', () => {
  let fixture: ComponentFixture<Sugestoes>;
  let el: HTMLElement;
  const api = { listar: vi.fn(), aprovar: vi.fn(), rejeitar: vi.fn() };
  const hospitalApi = { listar: vi.fn() };

  function botao(texto: string, raiz: ParentNode = el): HTMLButtonElement {
    const b = Array.from(raiz.querySelectorAll('button')).find((x) => x.textContent?.trim() === texto);
    if (!b) throw new Error(`botão "${texto}" não encontrado`);
    return b as HTMLButtonElement;
  }

  function render(): void {
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.restoreAllMocks();
    api.listar.mockReset().mockReturnValue(of(pagina([sugestao()])));
    api.aprovar.mockReset().mockReturnValue(of(sugestao({ status: 'APROVADA' })));
    api.rejeitar.mockReset().mockReturnValue(of(sugestao({ status: 'RECUSADA' })));
    hospitalApi.listar.mockReset().mockReturnValue(
      of(pagina([{ id: 'h9', nome: 'UBS Nova 1', tipo: 'PUBLICO', ativo: false } as never])),
    );
    await TestBed.configureTestingModule({
      imports: [Sugestoes],
      providers: [
        provideRouter([]),
        { provide: SugestaoApi, useValue: api },
        { provide: HospitalApi, useValue: hospitalApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Sugestoes);
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    render();
  });

  it('abre na fila de pendentes, com endereço e observação', () => {
    expect(api.listar).toHaveBeenCalledWith('PENDENTE', 0, 20);
    expect(el.textContent).toContain('UBS Nova');
    expect(el.textContent).toContain('QR 100 · Brasília/DF');
    expect(el.textContent).toContain('Abriu mês passado');
  });

  it('filtro "Todas" lista sem status', () => {
    const select = el.querySelector('select') as HTMLSelectElement;
    select.value = '';
    select.dispatchEvent(new Event('change'));
    expect(api.listar).toHaveBeenLastCalledWith(null, 0, 20);
  });

  it('aprovar busca hospitais pelo nome sugerido (inclui inativos) e vincula o escolhido', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    botao('Aprovar').click();
    render();
    expect(hospitalApi.listar).toHaveBeenCalledWith({ busca: 'UBS Nova', status: 'TODOS', page: 0, size: 5 });
    expect(el.textContent).toContain('UBS Nova 1');
    expect(el.textContent).toContain('Inativo');

    botao('Vincular').click();
    render();
    expect(api.aprovar).toHaveBeenCalledWith('s1', 'h9');
    expect(api.listar).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('aprovada e vinculada a "UBS Nova 1"');
  });

  it('vincular cancelado no confirm não chama a API', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    botao('Aprovar').click();
    render();
    botao('Vincular').click();
    expect(api.aprovar).not.toHaveBeenCalled();
  });

  it('recusar só habilita com motivo de 5 a 500 caracteres (sem contar espaços nas pontas)', () => {
    botao('Recusar').click();
    render();
    const textarea = el.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = '   abc   ';
    textarea.dispatchEvent(new Event('input'));
    render();
    expect(botao('Confirmar recusa').disabled).toBe(true);

    textarea.value = '  Duplicada  ';
    textarea.dispatchEvent(new Event('input'));
    render();
    expect(botao('Confirmar recusa').disabled).toBe(false);
    botao('Confirmar recusa').click();
    render();
    expect(api.rejeitar).toHaveBeenCalledWith('s1', 'Duplicada');
    expect(el.textContent).toContain('recusada');
  });

  it('409 (revisada por outro admin) recarrega a fila e avisa', () => {
    api.rejeitar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    botao('Recusar').click();
    render();
    const textarea = el.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'Duplicada';
    textarea.dispatchEvent(new Event('input'));
    render();
    botao('Confirmar recusa').click();
    render();
    expect(api.listar).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('já tinha sido revisada');
  });

  it('erro genérico mantém o painel aberto com a mensagem', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.aprovar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    botao('Aprovar').click();
    render();
    botao('Vincular').click();
    render();
    expect(el.textContent).toContain('Não foi possível concluir a ação');
    expect(botao('Vincular')).toBeTruthy();
    expect(api.listar).toHaveBeenCalledTimes(1);
  });

  it('sugestão aprovada mostra o link do hospital vinculado e nenhuma ação', () => {
    api.listar.mockReturnValue(
      of(pagina([sugestao({ status: 'APROVADA', hospitalId: 'h9', revisadoEm: '2026-09-21T10:00:00Z' })])),
    );
    const select = el.querySelector('select') as HTMLSelectElement;
    select.value = 'APROVADA';
    select.dispatchEvent(new Event('change'));
    render();
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/hospitais/h9');
    expect(Array.from(el.querySelectorAll('button')).some((b) => b.textContent?.trim() === 'Aprovar')).toBe(false);
  });

  it('esvaziar a última página volta para a anterior', () => {
    api.listar.mockReturnValue(of(pagina([sugestao()], { totalPages: 2, totalElements: 21 })));
    const select = el.querySelector('select') as HTMLSelectElement;
    select.dispatchEvent(new Event('change'));
    render();
    api.listar
      .mockReturnValueOnce(of(pagina([], { page: 1, totalPages: 1, totalElements: 20 })))
      .mockReturnValueOnce(of(pagina([sugestao({ id: 's2', nome: 'Outra' })], { totalPages: 1, totalElements: 20 })));
    botao('Próxima').click();
    render();
    expect(api.listar).toHaveBeenLastCalledWith('PENDENTE', 0, 20);
    expect(el.textContent).toContain('Outra');
  });

  it('falha ao listar mostra erro', () => {
    api.listar.mockReturnValue(throwError(() => new Error('x')));
    const select = el.querySelector('select') as HTMLSelectElement;
    select.dispatchEvent(new Event('change'));
    render();
    expect(el.textContent).toContain('Não foi possível carregar as sugestões');
  });
});
