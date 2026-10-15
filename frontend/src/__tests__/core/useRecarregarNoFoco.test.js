/**
 * Recarga ao voltar para a tela: o primeiro foco (montagem) não repete a busca.
 */
import { renderHook } from "@testing-library/react-native";
import { useRecarregarNoFoco } from "../../core/query/useRecarregarNoFoco";

const callbacks = [];
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback) => {
    callbacks.push(callback);
  },
}));

describe("useRecarregarNoFoco", () => {
  test("ignora o primeiro foco e recarrega nos seguintes", () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    renderHook(() => useRecarregarNoFoco(refetch));
    const aoFocar = callbacks[callbacks.length - 1];

    aoFocar();
    expect(refetch).not.toHaveBeenCalled();

    aoFocar();
    aoFocar();
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  test("inativo (query desabilitada, ex.: sem sessão) não recarrega", () => {
    const refetch = jest.fn();
    renderHook(() => useRecarregarNoFoco(refetch, false));
    const aoFocar = callbacks[callbacks.length - 1];

    aoFocar();
    aoFocar();
    expect(refetch).not.toHaveBeenCalled();
  });
});
