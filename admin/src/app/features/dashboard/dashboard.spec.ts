import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { Dashboard } from './dashboard';
import { Auth } from '../../core/auth/auth';
import { Usuario } from '../../core/auth/auth.models';

describe('Dashboard', () => {
  let fixture: ComponentFixture<Dashboard>;
  const auth = {
    usuario: signal<Usuario | null>({ id: '1', nome: 'Admin', email: 'a@x.com', papel: 'ADMIN' }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [{ provide: Auth, useValue: auth }],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('mostra o nome do usuário e os cartões da visão geral', () => {
    const t = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(t).toContain('Admin');
    expect(t).toContain('Hospitais cadastrados');
  });
});
