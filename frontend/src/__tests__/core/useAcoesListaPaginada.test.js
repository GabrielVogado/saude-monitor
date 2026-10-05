/**
 * Ações compartilhadas das listas paginadas (Hospitais e Ranking): puxar para atualizar
 * e carregar a próxima página sem duplicar o pedido.
 */
import { act, renderHook } from "@testing-library/react-native";
import { useAcoesListaPaginada } from "../../core/query/useAcoesListaPaginada";

function consulta(sobrescrever = {}) {
  return {
    refetch: jest.fn(() => Promise.resolve()),
    fetchNextPage: jest.fn(() => Promise.resolve()),
    hasNextPage: true,
    isFetchingNextPage: false,
    ...sobrescrever,
  };
}

describe("useAcoesListaPaginada", () => {
  test("atualizar liga o refreshing até a recarga terminar", async () => {
    let terminar;
    const props = consulta({
      refetch: jest.fn(
        () =>
          new Promise((resolve) => {
            terminar = resolve;
          })
      ),
    });
    const { result } = renderHook(() => useAcoesListaPaginada(props));

    let recarga;
    act(() => {
      recarga = result.current.atualizar();
    });
    expect(result.current.atualizando).toBe(true);

    await act(async () => {
      terminar();
      await recarga;
    });
    expect(result.current.atualizando).toBe(false);
  });

  test("falha na recarga também desliga o refreshing", async () => {
    const props = consulta({ refetch: jest.fn(() => Promise.reject(new Error("offline"))) });
    const { result } = renderHook(() => useAcoesListaPaginada(props));

    await act(async () => {
      await expect(result.current.atualizar()).rejects.toThrow("offline");
    });

    expect(result.current.atualizando).toBe(false);
  });

  test("carregarMais pede a próxima página sem cancelar a que está em voo", () => {
    const props = consulta();
    const { result } = renderHook(() => useAcoesListaPaginada(props));

    result.current.carregarMais();

    expect(props.fetchNextPage).toHaveBeenCalledWith({ cancelRefetch: false });
  });

  test.each([
    ["sem próxima página", { hasNextPage: false }],
    ["com página já em voo", { isFetchingNextPage: true }],
  ])("carregarMais não faz nada %s", (_caso, estado) => {
    const props = consulta(estado);
    const { result } = renderHook(() => useAcoesListaPaginada(props));

    result.current.carregarMais();

    expect(props.fetchNextPage).not.toHaveBeenCalled();
  });

  test("falha da próxima página é engolida, a lista visível fica", async () => {
    const props = consulta({ fetchNextPage: jest.fn(() => Promise.reject(new Error("rede"))) });
    const { result } = renderHook(() => useAcoesListaPaginada(props));

    expect(() => result.current.carregarMais()).not.toThrow();
    await act(async () => {});
  });
});
