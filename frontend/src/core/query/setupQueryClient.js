import { AppState, Platform } from "react-native";
import { focusManager, onlineManager } from "@tanstack/react-query";
import * as Network from "expo-network";
import { sessaoStore } from "../stores/sessaoStore";
import { queryClient, removerDadosPessoais } from "./queryClient";

function estaOnline(estado) {
  return Boolean(estado?.isConnected) && estado?.isInternetReachable !== false;
}

/**
 * Liga o TanStack Query ao ciclo de vida do celular (SDD, §6.2).
 *
 * O React Native não tem os eventos `focus`/`online` da janela do navegador: sem esta
 * ponte, `refetchOnWindowFocus` e `refetchOnReconnect` nunca disparariam. Na web o
 * próprio TanStack Query já escuta a janela.
 *
 * Também remove do cache o dado pessoal quando a sessão termina, venha o logout de
 * onde vier (botão Sair, exclusão de conta ou refresh rejeitado no interceptor 401).
 *
 * @returns {() => void} desfaz as inscrições.
 */
export function configurarQueryNoApp(cliente = queryClient) {
  if (Platform.OS !== "web") {
    onlineManager.setEventListener((definirOnline) => {
      const inscricao = Network.addNetworkStateListener?.((estado) => definirOnline(estaOnline(estado)));
      Network.getNetworkStateAsync()
        .then((estado) => definirOnline(estaOnline(estado)))
        .catch(() => {});
      return () => inscricao?.remove?.();
    });
  }

  const inscricaoAppState = AppState.addEventListener("change", (status) => {
    if (Platform.OS !== "web") {
      focusManager.setFocused(status === "active");
    }
  });

  const cancelarSessao = sessaoStore.subscribe((estado, anterior) => {
    if (anterior.usuario && !estado.usuario) {
      removerDadosPessoais(cliente);
    }
  });

  return () => {
    inscricaoAppState?.remove?.();
    cancelarSessao();
  };
}
