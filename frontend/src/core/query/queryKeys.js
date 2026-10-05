/**
 * Fábrica central das chaves de query (SDD de TanStack Query e Zustand, §6.3).
 *
 * Cada chave começa pelo domínio (`hospitais`, `visitas`, `conta`), o que permite
 * invalidar ou remover um domínio inteiro de uma vez. As chaves com dado pessoal
 * ficam sob `visitas` e `conta`, removidas do cache no logout (`DOMINIOS_PESSOAIS`).
 */
export const queryKeys = {
  hospitais: {
    all: ["hospitais"],
    listas: () => [...queryKeys.hospitais.all, "lista"],
    lista: (filtros) => [...queryKeys.hospitais.listas(), filtros],
    detalhes: () => [...queryKeys.hospitais.all, "detalhe"],
    detalhe: (id) => [...queryKeys.hospitais.detalhes(), id],
    ranking: (filtros) => [...queryKeys.hospitais.all, "ranking", filtros],
  },
  visitas: {
    all: ["visitas"],
    ativa: (identidade) => [...queryKeys.visitas.all, "ativa", identidade ?? "anonimo"],
  },
  conta: {
    all: ["conta"],
    historico: (usuarioId) => [...queryKeys.conta.all, usuarioId, "historico"],
  },
};

/** Domínios do cache que guardam dado pessoal (removidos no logout). */
export const DOMINIOS_PESSOAIS = [queryKeys.visitas.all, queryKeys.conta.all];
