import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';

import { Dashboard } from './dashboard';
import { Auth } from '../../core/auth/auth';
import { HospitalApi } from '../../core/hospitais/hospital';
import { Usuario } from '../../core/auth/auth.models';

describe('Dashboard', () => {
  let fixture: ComponentFixture<Dashboard>;
  const auth = {
    usuario: signal<Usuario | null>({ id: '1', nome: 'Admin', email: 'a@x.com', papel: 'ADMIN' }),
  };
  const api = { listar: vi.fn() };

  beforeEach(async () => {
    api.listar.mockReset();
    api.listar.mockReturnValue(
      of({ content: [], page: 0, size: 1, totalElements: 340, totalPages: 340 }),
    );
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        { provide: Auth, useValue: auth },
        { provide: HospitalApi, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('mostra o nome do usuário e o total real de hospitais', () => {
    const t = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(t).toContain('Admin');
    expect(t).toContain('Hospitais cadastrados');
    expect(t).toContain('340');
    expect(api.listar).toHaveBeenCalledWith(expect.objectContaining({ status: 'TODOS' }));
  });
});
