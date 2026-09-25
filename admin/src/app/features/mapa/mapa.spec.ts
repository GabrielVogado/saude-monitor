import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { from, of, throwError } from 'rxjs';

import { Mapa } from './mapa';
import { Camada } from '../../core/camadas/camada';
import { HospitalApi } from '../../core/hospitais/hospital';

function pagina(hospitais: Record<string, unknown>[] = [], over: Record<string, unknown> = {}) {
  return {
    content: hospitais,
    page: 0,
    size: 100,
    totalElements: hospitais.length,
    totalPages: 1,
    ...over,
  };
}

const fc = { type: 'FeatureCollection' as const, features: [] };

describe('Mapa', () => {
  let fixture: ComponentFixture<Mapa>;
  let el: HTMLElement;
  const hospitalApi = { listar: vi.fn() };
  const camadaApi = { buscar: vi.fn() };

  beforeEach(async () => {
    hospitalApi.listar.mockReset();
    camadaApi.buscar.mockReset();
    hospitalApi.listar.mockReturnValue(of(pagina()));
    camadaApi.buscar.mockReturnValue(of(fc));

    await TestBed.configureTestingModule({
      imports: [Mapa],
      providers: [
        provideRouter([]),
        { provide: HospitalApi, useValue: hospitalApi },
        { provide: Camada, useValue: camadaApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Mapa);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges(); // dispara ngAfterViewInit -> inicializa o Leaflet
    await fixture.whenStable();
  });

  afterEach(() => fixture.destroy());

  it('inicializa o mapa e carrega hospitais respeitando o teto de 100 do backend', () => {
    expect(hospitalApi.listar).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'TODOS', page: 0, size: 100 }),
    );
  });

  it('percorre todas as páginas até completar o catálogo', () => {
    hospitalApi.listar.mockReset();
    const pagina1 = pagina(
      [{ id: '1', nome: 'A', tipo: 'PUBLICO', ativo: true, localizacao: { latitude: -15.9, longitude: -47.9 } }],
      { totalElements: 2, totalPages: 2 },
    );
    const pagina2 = pagina(
      [{ id: '2', nome: 'B', tipo: 'PUBLICO', ativo: true, localizacao: { latitude: -15.9, longitude: -47.9 } }],
      { page: 1, totalElements: 2, totalPages: 2 },
    );
    hospitalApi.listar.mockReturnValueOnce(of(pagina1)).mockReturnValueOnce(of(pagina2));

    fixture = TestBed.createComponent(Mapa);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();

    expect(hospitalApi.listar).toHaveBeenCalledTimes(2);
    expect(hospitalApi.listar).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 1, size: 100 }));
    expect(el.textContent).toContain('2 hospital(is)');
  });

  it('mostra o total de hospitais carregados', () => {
    hospitalApi.listar.mockReturnValue(
      of(pagina([{ id: '1', nome: 'A', tipo: 'PUBLICO', ativo: true, localizacao: { latitude: -15.9, longitude: -47.9 } }])),
    );
    fixture = TestBed.createComponent(Mapa);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();

    expect(el.textContent).toContain('1 hospital(is)');
  });

  it('busca a camada só na primeira vez que o toggle é ligado (cache)', () => {
    const checkbox = el.querySelector('input[type=checkbox]') as HTMLInputElement;

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    expect(camadaApi.buscar).toHaveBeenCalledTimes(1);
    expect(camadaApi.buscar).toHaveBeenCalledWith('regiao-administrativa');
  });

  it('mostra aviso e desmarca o checkbox se a camada falhar ao carregar', async () => {
    // Falha assíncrona de verdade (Promise), não `throwError` síncrono: uma chamada HTTP
    // real nunca resolve na mesma tick, e é exatamente essa folga que garante um render
    // intermediário com o checkbox marcado antes do erro desmarcá-lo — replicar isso é o
    // que prova que o binding `[checked]` (achado do code-review) funciona de verdade.
    camadaApi.buscar.mockReturnValue(from(Promise.reject(new Error('falha'))));
    const checkbox = el.querySelector('input[type=checkbox]') as HTMLInputElement;

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(checkbox.checked).toBe(true); // render intermediário: camada "ligando"

    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Não foi possível carregar a camada');
    expect(checkbox.checked).toBe(false);
  });

  it('mostra aviso se a listagem de hospitais falhar', () => {
    hospitalApi.listar.mockReturnValue(throwError(() => new Error('falha')));
    fixture = TestBed.createComponent(Mapa);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();

    expect(el.textContent).toContain('Não foi possível carregar os hospitais');
  });

  it('conteúdo do popup navega ao detalhe do hospital ao clicar em "Ver detalhes"', () => {
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conteudo: HTMLElement = (fixture.componentInstance as any).criarConteudoPopup({
      id: 'h1',
      nome: 'Hosp',
      tipo: 'PUBLICO',
      ativo: true,
    });
    expect(conteudo.textContent).toContain('Hosp');
    expect(conteudo.textContent).toContain('Ver detalhes');

    (conteudo.querySelector('button') as HTMLButtonElement).click();

    expect(navSpy).toHaveBeenCalledWith(['/hospitais', 'h1']);
  });
});
