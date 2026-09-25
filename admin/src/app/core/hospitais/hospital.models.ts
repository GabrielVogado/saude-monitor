/** Tipo de estabelecimento (espelha o enum do backend). */
export type TipoEstabelecimento = 'PUBLICO' | 'PRIVADO';

/** Filtro de status na listagem admin (espelha `StatusHospital` do backend). */
export type StatusHospital = 'ATIVOS' | 'INATIVOS' | 'TODOS';

export interface Endereco {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
}

/** Hospital resumido devolvido pela listagem (espelha `HospitalResumoResponse`). */
export interface Hospital {
  id: string;
  nome: string;
  tipo: TipoEstabelecimento;
  tipoUnidade?: string;
  endereco?: Endereco;
  raioMetros?: number;
  ativo: boolean;
}

/** Envelope paginado do backend (`PageResponse<T>`). */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ListarHospitaisParams {
  busca?: string;
  tipo?: TipoEstabelecimento;
  status?: StatusHospital;
  page?: number;
  size?: number;
}
