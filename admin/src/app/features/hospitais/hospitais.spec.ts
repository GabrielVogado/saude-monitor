import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { Hospitais } from './hospitais';
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
  const api = { listar: vi.fn() };

  beforeEach(async () => {
    api.listar.mockReset();
    api.listar.mockReturnValue(of(pagina()));
    await TestBed.configureTestingModule({
      imports: [Hospitais],
      providers: [{ provide: HospitalApi, useValue: api }],
    }).compileComponents();

    fixture = TestBed.createComponent(Hospitais);
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('carrega e renderiza os hospitais no init', () => {
    expect(api.listar).toHaveBeenCalledWith(expect.objectContaining({ busca: '', page: 0, size: 20 }));
    expect(el.textContent).toContain('Hosp A');
    expect(el.textContent).toContain('Público');
    expect(el.textContent).toContain('Brasília');
  });

  it('buscar reenvia com o termo e reseta a página', () => {
    const input = el.querySelector('input') as HTMLInputElement;
    input.value = 'ana';
    (el.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(api.listar).toHaveBeenLastCalledWith(expect.objectContaining({ busca: 'ana', page: 0, size: 20 }));
  });

  it('filtrar por tipo reenvia com o tipo e reseta a página', () => {
    const select = el.querySelector('select') as HTMLSelectElement;
    select.value = 'PRIVADO';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(api.listar).toHaveBeenLastCalledWith(expect.objectContaining({ tipo: 'PRIVADO', page: 0 }));
  });

  it('mostra estado vazio quando não há resultados', () => {
    api.listar.mockReturnValue(of(pagina({ content: [], totalElements: 0, totalPages: 0 })));
    (el.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Nenhum hospital encontrado');
  });
});
