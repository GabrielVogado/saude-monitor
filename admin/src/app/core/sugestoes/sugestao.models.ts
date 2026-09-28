import { Endereco } from '../hospitais/hospital.models';

/** Ciclo de vida da sugestão (espelha `StatusSugestao` do backend). */
export type StatusSugestao = 'PENDENTE' | 'APROVADA' | 'RECUSADA';

/** Sugestão pública de hospital com a trilha de revisão (espelha `SugestaoHospitalDetalheResponse`). */
export interface Sugestao {
  id: string;
  nome: string;
  endereco?: Endereco | null;
  observacao?: string | null;
  status: StatusSugestao;
  /** Hospital oficial ao qual a sugestão foi vinculada na aprovação. */
  hospitalId?: string | null;
  revisadoPor?: string | null;
  revisadoEm?: string | null;
  motivoRecusa?: string | null;
  criadoEm: string;
  atualizadoEm?: string | null;
}

/** Limites do `RejeitarSugestaoRequest` do backend. */
export const MOTIVO_RECUSA_MIN = 5;
export const MOTIVO_RECUSA_MAX = 500;
