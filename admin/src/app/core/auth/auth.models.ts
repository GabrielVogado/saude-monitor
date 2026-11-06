/** Papel do usuário no domínio. O painel admin só admite `ADMIN`. */
export type Papel = 'ADMIN' | 'USUARIO' | (string & {});

/** Usuário resumido devolvido pelo login (espelha `UsuarioDto` do backend). */
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
}

/** Corpo do `POST /api/v1/auth/painel/login`. */
export interface LoginRequest {
  email: string;
  password: string;
  rememberDevice: boolean;
}

/**
 * Resposta do login e do refresh do painel (espelha `PainelAuthResponse` do backend).
 * Sem refresh token: ele vai só no cookie `HttpOnly`, fora do alcance do JavaScript.
 */
export interface AuthResponse {
  accessToken: string;
  /** Validade do access token em segundos. */
  expiraEm: number;
  usuario: Usuario;
}
