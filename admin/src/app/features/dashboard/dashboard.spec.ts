import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';

import { Dashboard } from './dashboard';
import { Auth } from '../../core/auth/auth';
import { Usuario } from '../../core/auth/auth.models';

describe('Dashboard', () => {
  let fixture: ComponentFixture<Dashboard>;
  const auth = {
    usuario: signal<Usuario | null>({ id: '1', nome: 'Admin', email: 'a@x.com', papel: 'ADMIN' }),
    logout: vi.fn(),
  };
  const router = { navigate: vi.fn() };

  beforeEach(async () => {
    auth.logout.mockReset();
    router.navigate.mockReset();
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        { provide: Auth, useValue: auth },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('mostra o nome do usuário autenticado', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Admin');
  });

  it('sair() faz logout e volta ao login', () => {
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(auth.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
