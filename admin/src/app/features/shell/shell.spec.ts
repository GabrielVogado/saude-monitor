import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';

import { Shell } from './shell';
import { Auth } from '../../core/auth/auth';
import { Usuario } from '../../core/auth/auth.models';

describe('Shell', () => {
  let fixture: ComponentFixture<Shell>;
  let el: HTMLElement;
  const auth = {
    usuario: signal<Usuario | null>({ id: '1', nome: 'Admin', email: 'a@x.com', papel: 'ADMIN' }),
    logout: vi.fn(),
  };

  beforeEach(async () => {
    auth.logout.mockReset();
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([{ path: 'hospitais', children: [] }]),
        { provide: Auth, useValue: auth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Shell);
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('mostra o usuário e a navegação', () => {
    expect(el.textContent).toContain('Admin');
    expect(el.textContent).toContain('Visão geral');
    expect(el.textContent).toContain('Hospitais');
  });

  it('sair faz logout e navega ao login', () => {
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const botaoSair = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Sair'))!;
    botaoSair.click();
    expect(auth.logout).toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith(['/login']);
  });

  function botaoMenu(): HTMLButtonElement {
    return el.querySelector('button[aria-label="Abrir menu de navegação"]') as HTMLButtonElement;
  }

  it('menu mobile começa fechado (aside sem translate-x-0, sem overlay)', () => {
    expect(botaoMenu().getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('aside')?.classList.contains('translate-x-0')).toBe(false);
    expect(el.querySelector('[aria-hidden="true"].fixed')).toBeNull();
  });

  it('clicar no hamburger abre o menu (overlay + aside deslocado)', () => {
    botaoMenu().click();
    fixture.detectChanges();
    expect(botaoMenu().getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('aside')?.classList.contains('translate-x-0')).toBe(true);
    expect(el.querySelector('[aria-hidden="true"].fixed')).not.toBeNull();
  });

  it('clicar no overlay fecha o menu', () => {
    botaoMenu().click();
    fixture.detectChanges();
    (el.querySelector('[aria-hidden="true"].fixed') as HTMLElement).click();
    fixture.detectChanges();
    expect(botaoMenu().getAttribute('aria-expanded')).toBe('false');
  });

  it('navegar fecha o menu automaticamente', async () => {
    const router = TestBed.inject(Router);
    botaoMenu().click();
    fixture.detectChanges();
    expect(botaoMenu().getAttribute('aria-expanded')).toBe('true');

    await router.navigateByUrl('/hospitais');
    fixture.detectChanges();
    expect(botaoMenu().getAttribute('aria-expanded')).toBe('false');
  });
});
