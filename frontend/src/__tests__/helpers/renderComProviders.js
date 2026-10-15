import React from "react";
import { render } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * QueryClient isolado por teste: sem retry (o `apiClient` já repete) e sem coleta de
 * lixo durante o teste, para que nada vaze de um caso para o outro.
 */
export function criarQueryClientDeTeste() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

/** `render` com os providers do app que as telas migradas precisam. */
export function renderComProviders(ui, { queryClient = criarQueryClientDeTeste(), ...opcoes } = {}) {
  const Wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { ...render(ui, { wrapper: Wrapper, ...opcoes }), queryClient };
}
