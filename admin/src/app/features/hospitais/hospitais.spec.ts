import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { Hospitais } from './hospitais';
import { Camada } from '../../core/camadas/camada';
import { HospitalApi } from '../../core/hospitais/hospital';

function pagina(over: Record<string, unknown> = {}) {
  return {
    content: [{ id: '1', nome: 'Hosp A', tipo: 'PUBLICO', ativo: true, endereco: { cidade: 'Brasília', uf: 'DF' } }],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
    ...over,
  };
}

describe('Hospitais', () => {
  let fixture: ComponentFixture<Hospitais>;
  let el: HTMLElement;
  const api = { listar: vi.fn(), alterarStatus: vi.fn() };
  const camadaApi = { nomesRegiaoAdministrativa: vi.fn() };

  function selects() {
    return Array.from(el.querySelectorAll('select')) as HTMLSelectElement[];
  }

  beforeEach(async () => {
    api.listar.mockReset();
    api.alterarStatus.mockReset();
    camadaApi.nomesRegiaoAdministrativa.mockReset();
    api.listar.mockReturnValue(of(pagina()));
    api.alterarStatus.mockReturnValue(of({}));
    camadaApi.nomesRegiaoAdministrativa.mockReturnValue(of(['Plano Piloto', 'Recanto das Emas']));
    await TestBed.configureTestingModule({
      imports: [Hospitais],
      providers: [
        { provide: HospitalApi, useValue: api },
        { provide: Camada, useValue: camadaApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Hospitais);
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('carrega no init com status TODOS por padrão', () => {
    expect(api.listar).toHaveBeenCalledWith(
      expect.objectContaining({ busca: '', status: 'TODOS', page: 0, size: 20 }),
    );
    expect(el.textContent).toContain('Hosp A');
    expect(el.textContent).toContain('Público');
    expect(el.textContent).toContain('Brasília');
  });

  it('buscar reenvia com o termo e reseta a página', () => {
    const input = el.querySelector('input') as HTMLInputElement;
    input.value = 'ana';
    (el.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(api.listar).toHaveBeenLastCalledWith(expect.objectContaining({ busca: 'ana', page: 0 }));
  });

  it('filtrar por status INATIVOS reenvia com o status', () => {
    const statusSelect = selects()[0];
    statusSelect.value = 'INATIVOS';
    statusSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(api.listar).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'INATIVOS', page: 0 }));
  });

  it('filtrar por tipo reenvia com o tipo', () => {
    const tipoSelect = selects()[1];
    tipoSelect.value = 'PRIVADO';
    tipoSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(api.listar).toHaveBeenLastCalledWith(expect.objectContaining({ tipo: 'PRIVADO', page: 0 }));
  });

  it('popula o seletor de região com os nomes da camada e filtra ao escolher', () => {
    expect(camadaApi.nomesRegiaoAdministrativa).toHaveBeenCalled();
    const regiaoSelect = selects()[2];
    const opcoes = Array.from(regiaoSelect.options).map((o) => o.textContent?.trim());
    expect(opcoes).toEqual(['Todas as regiões', 'Plano Piloto', 'Recanto das Emas']);

    regiaoSelect.value = 'Plano Piloto';
    regiaoSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(api.listar).toHaveBeenLastCalledWith(
      expect.objectContaining({ regiaoAdministrativa: 'Plano Piloto', page: 0 }),
    );
  });

  it('segue funcionando se a camada de regiões falhar ao carregar', () => {
    camadaApi.nomesRegiaoAdministrativa.mockReturnValue(throwError(() => new Error('falha')));
    fixture = TestBed.createComponent(Hospitais);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();

    const regiaoSelect = selects()[2];
    expect(regiaoSelect.options).toHaveLength(1); // só "Todas as regiões"
    expect(el.textContent).toContain('Hosp A'); // listagem principal não é afetada
  });

  it('mostra estado vazio quando não há resultados', () => {
    api.listar.mockReturnValue(of(pagina({ content: [], totalElements: 0, totalPages: 0 })));
    (el.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Nenhum hospital encontrado');
  });

  it('desativar chama alterarStatus(id, false) após confirmação e recarrega', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const botao = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Desativar')!;
    botao.click();
    fixture.detectChanges();
    expect(api.alterarStatus).toHaveBeenCalledWith('1', false);
    expect(api.listar).toHaveBeenCalledTimes(2); // init + reload
    confirmSpy.mockRestore();
  });

  it('não altera status se a confirmação for cancelada', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const botao = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Desativar')!;
    botao.click();
    fixture.detectChanges();
    expect(api.alterarStatus).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('erro ao alterar status mantém a lista e mostra aviso (não apaga a tabela)', () => {
    api.alterarStatus.mockReturnValue(throwError(() => new Error('falha')));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const botao = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Desativar')!;
    botao.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Hosp A'); // a lista permanece visível
    expect(el.textContent).toContain('Não foi possível desativar');
    confirmSpy.mockRestore();
  });
});
