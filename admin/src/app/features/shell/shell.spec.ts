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

  it('menu aponta Hospitais, Mapa e Sugestões para telas reais (E7-09)', () => {
    const hrefs = Array.from(el.querySelectorAll('nav a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/dashboard', '/hospitais', '/mapa', '/sugestoes']);
    expect(el.textContent).not.toContain('em breve');
  });

  it('sair faz logout e navega ao login', () => {
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const botaoSair = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Sair'))!;
    botaoSair.click();
    expect(auth.logout).toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith(['/login']);
  });

  it('se a navegação ao login falhar depois do logout, registra o erro em vez de engolir', async () => {
    const router = TestBed.inject(Router);
    const falha = new Error('chunk do login não carregou');
    vi.spyOn(router, 'navigate').mockRejectedValue(falha);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const botaoSair = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Sair'))!;

    botaoSair.click();
    await fixture.whenStable();

    expect(auth.logout).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('Logout feito, mas a navegação ao login falhou.', falha);
    log.mockRestore();
  });

  function botaoMenu(): HTMLButtonElement {
    return el.querySelector('button[aria-label="Abrir menu de navegação"]') as HTMLButtonElement;
  }

  it('menu mobile começa fechado (aside sem translate-x-0, sem overlay)', () => {
    expect(botaoMenu().getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('aside')?.classList.contains('translate-x-0')).toBe(false);
    expect(el.querySelector('button[aria-label="Fechar menu de navegação"]')).toBeNull();
  });

  it('clicar no hamburger abre o menu (overlay + aside deslocado)', () => {
    botaoMenu().click();
    fixture.detectChanges();
    expect(botaoMenu().getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('aside')?.classList.contains('translate-x-0')).toBe(true);
    expect(el.querySelector('button[aria-label="Fechar menu de navegação"]')).not.toBeNull();
  });

  it('clicar no overlay fecha o menu', () => {
    botaoMenu().click();
    fixture.detectChanges();
    (el.querySelector('button[aria-label="Fechar menu de navegação"]') as HTMLElement).click();
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

  it('overlay do menu é um botão acionável por teclado, com nome acessível', () => {
    botaoMenu().click();
    fixture.detectChanges();
    const overlay = el.querySelector('.fixed.inset-0') as HTMLElement;

    expect(overlay.tagName).toBe('BUTTON');
    expect(overlay.getAttribute('type')).toBe('button');
    expect(overlay.getAttribute('aria-label')).toBe('Fechar menu de navegação');
    expect(overlay.hasAttribute('aria-hidden')).toBe(false);
    overlay.focus();
    expect(document.activeElement).toBe(overlay);
  });
});
