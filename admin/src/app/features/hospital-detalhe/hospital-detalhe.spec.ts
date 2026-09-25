import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { HospitalDetalhe } from './hospital-detalhe';
import { HospitalApi } from '../../core/hospitais/hospital';
import { HospitalDetalheResponse } from '../../core/hospitais/hospital.models';

function hospital(over: Partial<HospitalDetalheResponse> = {}): HospitalDetalheResponse {
  return {
    id: 'h1',
    nome: 'Hospital de Teste',
    tipo: 'PUBLICO',
    ativo: true,
    regiaoAdministrativa: 'Plano Piloto',
    endereco: { cidade: 'Brasília', uf: 'DF' },
    ...over,
  };
}

describe('HospitalDetalhe', () => {
  let fixture: ComponentFixture<HospitalDetalhe>;
  let el: HTMLElement;
  const api = { buscarPorId: vi.fn() };

  function montar(id: string | null = 'h1'): void {
    TestBed.configureTestingModule({
      imports: [HospitalDetalhe],
      providers: [
        { provide: HospitalApi, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
      ],
    });
    fixture = TestBed.createComponent(HospitalDetalhe);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  beforeEach(() => api.buscarPorId.mockReset());

  it('busca pelo id da rota e mostra os dados', () => {
    api.buscarPorId.mockReturnValue(of(hospital()));
    montar('h1');

    expect(api.buscarPorId).toHaveBeenCalledWith('h1');
    expect(el.textContent).toContain('Hospital de Teste');
    expect(el.textContent).toContain('Plano Piloto');
    expect(el.textContent).toContain('Brasília');
  });

  it('mostra erro quando a API falha', () => {
    api.buscarPorId.mockReturnValue(throwError(() => new Error('falha')));
    montar('h1');

    expect(el.textContent).toContain('Não foi possível carregar');
  });

  it('mostra erro sem chamar a API quando não há id na rota', () => {
    montar(null);

    expect(api.buscarPorId).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Hospital não informado');
  });
});
