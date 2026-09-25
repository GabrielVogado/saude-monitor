import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { Login } from './login';
import { AcessoNaoAdminError, Auth } from '../../core/auth/auth';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let el: HTMLElement;
  const auth = { login: vi.fn() };
  const router = { navigate: vi.fn() };

  beforeEach(async () => {
    auth.login.mockReset();
    router.navigate.mockReset();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        { provide: Auth, useValue: auth },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  function preencher(email: string, senha: string): void {
    const [campoEmail, campoSenha] = Array.from(el.querySelectorAll('input')) as HTMLInputElement[];
    campoEmail.value = email;
    campoEmail.dispatchEvent(new Event('input'));
    campoSenha.value = senha;
    campoSenha.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function enviar(): void {
    (el.querySelector('button[type=submit]') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  it('não chama login com formulário inválido', () => {
    enviar();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('autentica e navega para /dashboard no sucesso', () => {
    auth.login.mockReturnValue(of({ id: '1', nome: 'A', email: 'a@x.com', papel: 'ADMIN' }));
    preencher('a@x.com', 'senha');
    enviar();
    expect(auth.login).toHaveBeenCalledWith('a@x.com', 'senha');
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('mostra mensagem quando a conta não é administradora', () => {
    auth.login.mockReturnValue(throwError(() => new AcessoNaoAdminError()));
    preencher('a@x.com', 'senha');
    enviar();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('acesso administrativo');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('mostra mensagem de credenciais inválidas no 401', () => {
    auth.login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    preencher('a@x.com', 'senha');
    enviar();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('inválidos');
  });
});
