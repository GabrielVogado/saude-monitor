import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import TokenStorage from "../../services/TokenStorage";

/**
 * Estado global da sessão no app (SDD de TanStack Query e Zustand, §6.4).
 *
 * Antes, cada tela lia o usuário do AsyncStorage no próprio foco e nenhuma era
 * avisada quando o interceptor 401 encerrava a sessão: o Perfil continuava mostrando
 * o usuário até o próximo foco. Agora o `LoginService` escreve aqui a cada login,
 * renovação e logout, e as telas reagem na hora.
 *
 * Store vanilla do Zustand (`getState`/`setState`/`subscribe`) porque quem escreve a
 * sessão está fora do React: o `LoginService`, chamado pelo interceptor 401 e pela
 * tarefa de geofencing, que pode rodar sem nenhuma tela montada.
 *
 * **Sem `persist`.** A fonte de verdade continua sendo o `TokenStorage` (tokens no
 * SecureStore, usuário no AsyncStorage). Persistir o store criaria uma segunda cópia do
 * dado pessoal no aparelho, que um logout feito fora da árvore React poderia deixar
 * para trás. O store só espelha em memória e é hidratado do `TokenStorage` no boot.
 *
 * Este módulo não importa o `LoginService`: o `LoginService` é que importa este, e
 * assim não se recria o ciclo de import que o `apiClient` eliminou.
 */
export const sessaoStore = createStore((set) => ({
  /** Usuário autenticado, ou `null` no modo anônimo (a conta é opcional, E5-04). */
  usuario: null,
  /** `true` depois da primeira leitura do `TokenStorage`. */
  hidratada: false,

  definirUsuario: (usuario) => set({ usuario: usuario || null, hidratada: true }),
}));

/** Lê o usuário persistido e popula o store (chamado no boot do app). */
export async function hidratarSessao() {
  let usuario = null;
  try {
    usuario = await TokenStorage.getUsuario();
  } catch {
    // Leitura do armazenamento falhou: segue anônimo, como o Perfil já fazia.
  }
  sessaoStore.getState().definirUsuario(usuario);
}

/** Atalho para quem está fora do React. */
export function definirUsuarioDaSessao(usuario) {
  sessaoStore.getState().definirUsuario(usuario);
}

/**
 * Hook de leitura com seletor: o componente só re-renderiza quando a fatia
 * selecionada muda.
 */
export function useSessao(seletor = (estado) => estado) {
  return useStore(sessaoStore, seletor);
}
