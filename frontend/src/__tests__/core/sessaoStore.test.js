/**
 * Sessão global (SDD de TanStack Query e Zustand, §6.4): hidratação a partir do
 * TokenStorage e leitura reativa por seletor.
 */
import { act, renderHook } from "@testing-library/react-native";
import TokenStorage from "../../services/TokenStorage";
import {
  definirUsuarioDaSessao,
  hidratarSessao,
  sessaoStore,
  useSessao,
} from "../../core/stores/sessaoStore";

describe("sessaoStore", () => {
  beforeEach(() => {
    require("@react-native-async-storage/async-storage").default.__reset();
    sessaoStore.setState({ usuario: null, hidratada: false });
  });

  test("começa anônimo e ainda não hidratado", () => {
    expect(sessaoStore.getState()).toMatchObject({ usuario: null, hidratada: false });
  });

  test("hidratarSessao lê o usuário persistido pelo TokenStorage", async () => {
    await TokenStorage.salvarTokens({ accessToken: "A", refreshToken: "R", usuario: { id: "u1", nome: "Marina" } });

    await hidratarSessao();

    expect(sessaoStore.getState()).toMatchObject({ usuario: { id: "u1", nome: "Marina" }, hidratada: true });
  });

  test("sem usuário persistido, hidrata como anônimo", async () => {
    await hidratarSessao();

    expect(sessaoStore.getState()).toMatchObject({ usuario: null, hidratada: true });
  });

  test("falha ao ler o armazenamento hidrata como anônimo em vez de quebrar", async () => {
    jest.spyOn(TokenStorage, "getUsuario").mockRejectedValueOnce(new Error("disco"));

    await hidratarSessao();

    expect(sessaoStore.getState()).toMatchObject({ usuario: null, hidratada: true });
  });

  test("definirUsuarioDaSessao normaliza ausência para null", () => {
    definirUsuarioDaSessao({ id: "u1" });
    expect(sessaoStore.getState().usuario).toEqual({ id: "u1" });

    definirUsuarioDaSessao(undefined);
    expect(sessaoStore.getState().usuario).toBeNull();
  });

  test("useSessao re-renderiza com a fatia selecionada quando a sessão muda fora do React", () => {
    const { result } = renderHook(() => useSessao((estado) => estado.usuario?.nome ?? null));
    expect(result.current).toBeNull();

    act(() => definirUsuarioDaSessao({ id: "u1", nome: "Marina" }));
    expect(result.current).toBe("Marina");

    act(() => definirUsuarioDaSessao(null));
    expect(result.current).toBeNull();
  });

  test("useSessao sem seletor devolve o estado inteiro", () => {
    const { result } = renderHook(() => useSessao());
    expect(result.current).toMatchObject({ usuario: null });
  });
});
