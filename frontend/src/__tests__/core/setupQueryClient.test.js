/**
 * Ponte do TanStack Query com o celular: foco do app, conexão e fim da sessão.
 */
import { AppState, Platform } from "react-native";
import { focusManager, onlineManager } from "@tanstack/react-query";
import * as Network from "expo-network";
import { configurarQueryNoApp } from "../../core/query/setupQueryClient";
import { criarQueryClient } from "../../core/query/queryClient";
import { queryKeys } from "../../core/query/queryKeys";
import { definirUsuarioDaSessao, sessaoStore } from "../../core/stores/sessaoStore";

describe("configurarQueryNoApp", () => {
  let ouvinteAppState;
  let ouvinteRede;
  const removerAppState = jest.fn();
  const removerRede = jest.fn();
  let desfazer;

  beforeEach(() => {
    sessaoStore.setState({ usuario: null, hidratada: true });
    jest.spyOn(AppState, "addEventListener").mockImplementation((_evento, ouvinte) => {
      ouvinteAppState = ouvinte;
      return { remove: removerAppState };
    });
    Network.addNetworkStateListener.mockImplementation((ouvinte) => {
      ouvinteRede = ouvinte;
      return { remove: removerRede };
    });
    Network.getNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: true });
  });

  afterEach(() => {
    desfazer?.();
    desfazer = undefined;
    onlineManager.setOnline(true);
    focusManager.setFocused(undefined);
    jest.restoreAllMocks();
  });

  test("o app em segundo plano tira o foco do TanStack Query; ao voltar, devolve", () => {
    desfazer = configurarQueryNoApp(criarQueryClient());

    ouvinteAppState("background");
    expect(focusManager.isFocused()).toBe(false);

    ouvinteAppState("active");
    expect(focusManager.isFocused()).toBe(true);
  });

  test("a conexão do aparelho alimenta o onlineManager", async () => {
    desfazer = configurarQueryNoApp(criarQueryClient());

    ouvinteRede({ isConnected: false });
    expect(onlineManager.isOnline()).toBe(false);

    ouvinteRede({ isConnected: true, isInternetReachable: false });
    expect(onlineManager.isOnline()).toBe(false);

    ouvinteRede({ isConnected: true, isInternetReachable: true });
    expect(onlineManager.isOnline()).toBe(true);
  });

  test("o estado inicial da rede é lido na inscrição, e uma falha na leitura é ignorada", async () => {
    Network.getNetworkStateAsync.mockResolvedValueOnce({ isConnected: false });
    desfazer = configurarQueryNoApp(criarQueryClient());
    await new Promise((r) => {
      setImmediate(r);
    });
    expect(onlineManager.isOnline()).toBe(false);

    desfazer();
    Network.getNetworkStateAsync.mockRejectedValueOnce(new Error("indisponível"));
    desfazer = configurarQueryNoApp(criarQueryClient());
    await new Promise((r) => {
      setImmediate(r);
    });
  });

  test("o fim da sessão remove o dado pessoal do cache, e só ele", () => {
    const cliente = criarQueryClient();
    definirUsuarioDaSessao({ id: "u1" });
    desfazer = configurarQueryNoApp(cliente);
    cliente.setQueryData(queryKeys.conta.historico("u1"), { visitas: [] });
    cliente.setQueryData(queryKeys.hospitais.detalhe("h1"), { id: "h1" });

    definirUsuarioDaSessao({ id: "u1", nome: "outro campo" });
    expect(cliente.getQueryData(queryKeys.conta.historico("u1"))).toEqual({ visitas: [] });

    definirUsuarioDaSessao(null);
    expect(cliente.getQueryData(queryKeys.conta.historico("u1"))).toBeUndefined();
    expect(cliente.getQueryData(queryKeys.hospitais.detalhe("h1"))).toEqual({ id: "h1" });
  });

  test("sem argumento, usa a instância do app", () => {
    desfazer = configurarQueryNoApp();
    expect(AppState.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  test("desfazer remove as inscrições", () => {
    const cliente = criarQueryClient();
    definirUsuarioDaSessao({ id: "u1" });
    configurarQueryNoApp(cliente)();
    cliente.setQueryData(queryKeys.conta.historico("u1"), { visitas: [] });

    definirUsuarioDaSessao(null);

    expect(removerAppState).toHaveBeenCalled();
    expect(cliente.getQueryData(queryKeys.conta.historico("u1"))).toEqual({ visitas: [] });
  });

  test("na web não mexe no foco nem na rede (o TanStack Query escuta a janela)", () => {
    const original = Platform.OS;
    Platform.OS = "web";
    try {
      desfazer = configurarQueryNoApp(criarQueryClient());
      ouvinteAppState("background");
      expect(focusManager.isFocused()).toBe(true);
      expect(Network.addNetworkStateListener).not.toHaveBeenCalled();
    } finally {
      Platform.OS = original;
    }
  });
});
