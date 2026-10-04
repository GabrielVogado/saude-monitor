import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { HospitalEditar } from './hospital-editar';
import { HospitalApi } from '../../core/hospitais/hospital';
import { HospitalDetalheResponse, HospitalRequest } from '../../core/hospitais/hospital.models';
import { centroide, criarCirculo, raioAproximadoMetros } from '../../core/hospitais/geofence';

const CENTRO = { latitude: -15.79, longitude: -47.88 };
/** Círculo "do produto": 32 lados, como o seed/importador do backend geram. */
const GEOFENCE_ORIGINAL = criarCirculo(CENTRO, 150, 32);

function hospital(over: Partial<HospitalDetalheResponse> = {}): HospitalDetalheResponse {
  return {
    id: 'h1',
    nome: 'Hospital de Teste',
    cnpj: null,
    tipo: 'PUBLICO',
    categoria: 'HOSPITAL',
    horarioFuncionamento: '24h',
    endereco: { logradouro: 'Rua A', cidade: 'Brasília', uf: 'DF', bairro: '' },
    contato: null,
    geofence: GEOFENCE_ORIGINAL,
    ativo: true,
    regiaoAdministrativa: 'Plano Piloto',
    indicadores: { indicadoresDisponiveis: true, notaMedia: 4.2, nAvaliacoes: 31 },
    ...over,
  };
}

describe('HospitalEditar', () => {
  let fixture: ComponentFixture<HospitalEditar>;
  let el: HTMLElement;
  let navigate: ReturnType<typeof vi.spyOn>;
  const api = { buscarPorId: vi.fn(), atualizar: vi.fn() };

  function montar(h: HospitalDetalheResponse | null = hospital(), id: string | null = 'h1'): void {
    if (h) {
      api.buscarPorId.mockReturnValue(of(h));
    }
    TestBed.configureTestingModule({
      imports: [HospitalEditar],
      providers: [
        provideRouter([]),
        { provide: HospitalApi, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(HospitalEditar);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  function input(nome: string): HTMLInputElement {
    return el.querySelector(`[formcontrolname="${nome}"]`) as HTMLInputElement;
  }

  function digitar(nome: string, valor: string): void {
    const i = input(nome);
    i.value = valor;
    i.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function enviar(): void {
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function corpoEnviado(): HospitalRequest {
    return api.atualizar.mock.calls[0][1] as HospitalRequest;
  }

  beforeEach(() => {
    api.buscarPorId.mockReset();
    api.atualizar.mockReset();
  });

  afterEach(() => fixture?.destroy());

  it('carrega o hospital da rota e preenche o formulário, com o raio medido do polígono', () => {
    montar();

    expect(api.buscarPorId).toHaveBeenCalledWith('h1');
    expect(input('nome').value).toBe('Hospital de Teste');
    expect(input('logradouro').value).toBe('Rua A');
    expect(input('uf').value).toBe('DF');
    expect(Number(input('raioMetros').value)).toBe(150);
    expect(el.querySelector('[aria-label="Prévia da área de detecção"]')).not.toBeNull();
  });

  it('não exibe indicadores nem avaliações na tela de edição (CA E7-06 / E7-08)', () => {
    montar();

    expect(el.textContent).not.toContain('4.2');
    expect(el.textContent).not.toContain('avaliação(ões)');
    expect(el.textContent).not.toMatch(/Nota /);
  });

  it('sem mudar o raio, reenvia o geofence original intacto e normaliza vazios', () => {
    api.atualizar.mockReturnValue(of(hospital()));
    montar();

    digitar('nome', '  Hospital Renomeado  ');
    digitar('uf', 'df');
    enviar();

    expect(api.atualizar).toHaveBeenCalledTimes(1);
    expect(api.atualizar.mock.calls[0][0]).toBe('h1');
    const corpo = corpoEnviado();
    expect(corpo.geofence).toEqual(GEOFENCE_ORIGINAL);
    expect(corpo.nome).toBe('Hospital Renomeado');
    expect(corpo.cnpj).toBeNull();
    expect(corpo.contato).toBeNull();
    expect(corpo.endereco.uf).toBe('DF');
    expect(corpo.endereco.bairro).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith(['/hospitais', 'h1']);
  });

  it('o corpo do PUT só carrega campos cadastrais — nada de feedback, indicador ou status', () => {
    api.atualizar.mockReturnValue(of(hospital()));
    montar();
    enviar();

    expect(Object.keys(corpoEnviado()).sort()).toEqual(
      ['categoria', 'cnpj', 'contato', 'endereco', 'geofence', 'nome', 'tipo'].sort(),
    );
  });

  it('mudar o raio substitui o polígono por um círculo de 48 lados em volta do mesmo centro', () => {
    api.atualizar.mockReturnValue(of(hospital()));
    montar();

    digitar('raioMetros', '200');
    expect(el.querySelector('[data-testid="aviso-geofence"]')?.textContent).toContain('círculo de 200 m');
    enviar();

    const anel = corpoEnviado().geofence.coordinates[0];
    expect(anel).toHaveLength(49);
    const c = centroide(corpoEnviado().geofence)!;
    expect(c.latitude).toBeCloseTo(CENTRO.latitude, 5);
    expect(c.longitude).toBeCloseTo(CENTRO.longitude, 5);
    expect(raioAproximadoMetros(corpoEnviado().geofence, c)).toBe(200);
  });

  it('raio medido fora da faixa (contorno à mão) não trava a edição dos outros campos', () => {
    api.atualizar.mockReturnValue(of(hospital()));
    const grande = criarCirculo(CENTRO, 1200, 7); // irregular para o backend: 7 lados
    montar(hospital({ geofence: grande }));

    expect(Number(input('raioMetros').value)).toBe(1200);
    digitar('nome', 'Outro nome');
    enviar();

    expect(api.atualizar).toHaveBeenCalledTimes(1);
    expect(corpoEnviado().geofence).toEqual(grande);
  });

  it('CNPJ gravado só com dígitos (importação CNES) é aceito e enviado mascarado', () => {
    api.atualizar.mockReturnValue(of(hospital()));
    montar(hospital({ cnpj: '00394544000185' }));
    enviar();

    expect(corpoEnviado().cnpj).toBe('00.394.544/0001-85');
  });

  it('trocar a categoria sobre o círculo padrão avisa que o raio vai seguir a categoria', () => {
    montar();
    const aviso = () => el.querySelector('[data-testid="aviso-geofence"]')?.textContent ?? '';
    expect(aviso()).toContain('mantido como está');

    const select = el.querySelector('[formcontrolname="categoria"]') as HTMLSelectElement;
    select.value = select.options[3].value; // UBS
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(aviso()).toContain('seguir o padrão da categoria');
  });

  it('contorno próprio (não é o círculo padrão) não recebe o aviso de categoria', () => {
    montar(hospital({ geofence: criarCirculo(CENTRO, 150) })); // 48 lados
    const select = el.querySelector('[formcontrolname="categoria"]') as HTMLSelectElement;
    select.value = select.options[3].value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="aviso-geofence"]')?.textContent).toContain('mantido como está');
  });

  it('raio inválido não promete substituição e a prévia fica no contorno atual', () => {
    montar();
    digitar('raioMetros', '5');

    const aviso = el.querySelector('[data-testid="aviso-geofence"]')?.textContent ?? '';
    expect(aviso).not.toContain('será substituído');
    expect(aviso).toContain('Enquanto o raio não for válido');
    expect(el.textContent).toContain('Entre 30 e 1000 m.');
  });

  it('UF com uma letra e espaço é barrada no formulário', () => {
    montar();
    digitar('uf', 'D ');
    enviar();

    expect(api.atualizar).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Duas letras');
  });

  it('salvou mas a navegação ao detalhe falha: avisa que as alterações foram salvas', async () => {
    api.atualizar.mockReturnValue(of(hospital()));
    montar();
    navigate.mockRejectedValue(new Error('chunk do detalhe não carregou'));

    enviar();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith(['/hospitais', 'h1']);
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Alterações salvas');
  });

  it('resposta que chega depois de sair da tela não navega', () => {
    const resposta = new Subject<HospitalDetalheResponse>();
    api.atualizar.mockReturnValue(resposta);
    montar();
    enviar();

    fixture.destroy();
    resposta.next(hospital());

    expect(navigate).not.toHaveBeenCalled();
  });

  it('formulário inválido não chama a API e marca os campos', () => {
    montar();

    digitar('nome', '');
    digitar('cnpj', '123');
    digitar('raioMetros', '5');
    enviar();

    expect(api.atualizar).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Informe o nome');
    expect(el.textContent).toContain('00.000.000/0000-00.');
    expect(el.textContent).toContain('Entre 30 e 1000 m.');
  });

  it('mostra a mensagem do backend em conflito de nome/CNPJ (409)', () => {
    api.atualizar.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { code: 'CONFLITO', message: 'Já existe um hospital com o nome informado.' },
          }),
      ),
    );
    montar();
    enviar();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Já existe um hospital com o nome informado.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('lista os campos inválidos devolvidos pelo backend (400)', () => {
    api.atualizar.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              code: 'CAMPOS_INVALIDOS',
              message: 'Requisição contém campos inválidos.',
              details: [{ campo: 'contato.email', mensagem: 'e-mail deve ser válido' }],
            },
          }),
      ),
    );
    montar();
    enviar();

    expect(el.textContent).toContain('Requisição contém campos inválidos.');
    expect(el.textContent).toContain('contato.email: e-mail deve ser válido');
  });

  it('403 vira mensagem de permissão, sem vazar o corpo', () => {
    api.atualizar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    montar();
    enviar();

    expect(el.textContent).toContain('não tem permissão para editar');
  });

  it('hospital sem geofence não pode ser salvo', () => {
    montar(hospital({ geofence: null }));

    expect(el.textContent).toContain('não tem geofence cadastrado');
    expect((el.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    enviar();
    expect(api.atualizar).not.toHaveBeenCalled();
  });

  it('mostra erro quando o carregamento falha', () => {
    api.buscarPorId.mockReturnValue(throwError(() => new Error('falha')));
    montar(null);

    expect(el.textContent).toContain('Não foi possível carregar');
  });

  it('sem id na rota não chama a API', () => {
    montar(null, null);

    expect(api.buscarPorId).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Hospital não informado.');
  });
});
