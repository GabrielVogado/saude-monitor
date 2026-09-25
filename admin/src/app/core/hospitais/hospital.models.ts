/** Tipo de estabelecimento (espelha o enum do backend). */
export type TipoEstabelecimento = 'PUBLICO' | 'PRIVADO';

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
  page?: number;
  size?: number;
}
