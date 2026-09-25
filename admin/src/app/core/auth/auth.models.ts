/** Papel do usuário no domínio. O painel admin só admite `ADMIN`. */
export type Papel = 'ADMIN' | 'USUARIO' | (string & {});

/** Usuário resumido devolvido pelo login (espelha `UsuarioDto` do backend). */
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
}

/** Corpo do `POST /api/v1/auth/login`. */
export interface LoginRequest {
  email: string;
  password: string;
  rememberDevice: boolean;
}

/** Resposta do login/refresh (espelha `AuthResponse` do backend). */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  /** Validade do access token em segundos. */
  expiraEm: number;
  usuario: Usuario;
}
