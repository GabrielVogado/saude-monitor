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

export interface Contato {
  telefone?: string;
  email?: string;
}

/** Ponto geográfico do centroide do hospital (espelha `LocalizacaoDto`). */
export interface Localizacao {
  latitude: number;
  longitude: number;
}

export interface Indicadores {
  indicadoresDisponiveis: boolean;
  notaMedia?: number;
  nAvaliacoes?: number;
  tempoMedianoMinutos?: number;
}

/** Hospital resumido devolvido pela listagem (espelha `HospitalResumoResponse`). */
export interface Hospital {
  id: string;
  nome: string;
  tipo: TipoEstabelecimento;
  tipoUnidade?: string;
  endereco?: Endereco;
  localizacao?: Localizacao;
  raioMetros?: number;
  ativo: boolean;
  /** Região Administrativa (E7-03) — derivada das coordenadas; pode ser `null`. */
  regiaoAdministrativa?: string | null;
}

/** Detalhe completo do hospital (E7-05) — espelha `HospitalResponse`. */
export interface HospitalDetalheResponse {
  id: string;
  nome: string;
  cnpj?: string;
  tipo: TipoEstabelecimento;
  categoria?: string;
  horarioFuncionamento?: string;
  salaVacina?: boolean;
  farmacia?: boolean;
  coletaMaterial?: boolean;
  tipoUnidade?: string;
  endereco?: Endereco;
  contato?: Contato;
  ativo: boolean;
  regiaoAdministrativa?: string | null;
  indicadores?: Indicadores;
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
  /** Nome exato da Região Administrativa (E7-03) — vem de `Camada.nomesRegiaoAdministrativa()`. */
  regiaoAdministrativa?: string;
  page?: number;
  size?: number;
}
