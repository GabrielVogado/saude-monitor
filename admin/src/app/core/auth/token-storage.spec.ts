import { TestBed } from '@angular/core/testing';

import { TokenStorage } from './token-storage';

const usuario = { id: '1', nome: 'Admin', email: 'admin@x.com', papel: 'ADMIN' };

describe('TokenStorage (ADR-013)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it('guarda o access só em memória e só o usuário no sessionStorage', () => {
    const storage = TestBed.inject(TokenStorage);

    storage.salvar('access.secreto', usuario);

    expect(storage.getAccessToken()).toBe('access.secreto');
    expect(storage.accessToken()).toBe('access.secreto');
    expect(Object.keys(sessionStorage)).toEqual(['admin.usuario']);
    expect(sessionStorage.getItem('admin.usuario')).not.toContain('access.secreto');
    expect(storage.getUsuario()).toEqual(usuario);
  });

  it('não tem como guardar refresh token', () => {
    const storage = TestBed.inject(TokenStorage) as unknown as Record<string, unknown>;
    expect(storage['getRefreshToken']).toBeUndefined();
  });

  it('ao recarregar a aba, o access não volta do storage (só o usuário)', () => {
    TestBed.inject(TokenStorage).salvar('access.secreto', usuario);
    TestBed.resetTestingModule();

    const novaInstancia = TestBed.inject(TokenStorage);

    expect(novaInstancia.getAccessToken()).toBeNull();
    expect(novaInstancia.getUsuario()).toEqual(usuario);
  });

  it('apaga os tokens que versões anteriores do painel deixaram no sessionStorage', () => {
    sessionStorage.setItem('admin.accessToken', 'access.antigo');
    sessionStorage.setItem('admin.refreshToken', 'refresh.antigo');

    TestBed.inject(TokenStorage);

    expect(sessionStorage.getItem('admin.accessToken')).toBeNull();
    expect(sessionStorage.getItem('admin.refreshToken')).toBeNull();
  });

  it('limpar apaga o access e o usuário', () => {
    const storage = TestBed.inject(TokenStorage);
    storage.salvar('access.secreto', usuario);

    storage.limpar();

    expect(storage.getAccessToken()).toBeNull();
    expect(storage.getUsuario()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it('usuário ilegível no storage vira "sem usuário"', () => {
    sessionStorage.setItem('admin.usuario', '{quebrado');
    expect(TestBed.inject(TokenStorage).getUsuario()).toBeNull();
  });

  it('storage bloqueado não lança: o access segue em memória', () => {
    const storage = TestBed.inject(TokenStorage);
    const bloqueio = () => {
      throw new DOMException('bloqueado', 'SecurityError');
    };
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(bloqueio);
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(bloqueio);
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(bloqueio);

    expect(() => storage.salvar('access.secreto', usuario)).not.toThrow();
    expect(storage.getAccessToken()).toBe('access.secreto');
    expect(storage.getUsuario()).toBeNull();
    expect(() => storage.limpar()).not.toThrow();

    set.mockRestore();
    get.mockRestore();
    remove.mockRestore();
  });
});
