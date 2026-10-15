import { useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";

/**
 * Recarrega a query quando a tela volta a ganhar foco na navegação.
 *
 * O `refetchOnWindowFocus` do TanStack Query cobre o app voltando do segundo plano,
 * não a troca de aba ou o retorno de uma tela empilhada. Ignora o primeiro foco, que
 * coincide com a montagem (a query já busca ao montar).
 *
 * `ativo` deve acompanhar o `enabled` da query: o `refetch()` do TanStack Query busca
 * mesmo com a query desabilitada, e sem essa guarda a tela consultaria a API sem
 * sessão a cada retorno.
 */
export function useRecarregarNoFoco(refetch, ativo = true) {
  const primeiroFoco = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (primeiroFoco.current) {
        primeiroFoco.current = false;
        return;
      }
      if (ativo) {
        void refetch();
      }
    }, [refetch, ativo])
  );
}
