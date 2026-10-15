# Relatório de Auditoria Técnica — Saúde Monitor (Frontend Mobile)
**Versão:** 4.0 (substitui a v3.0 de agosto/2026)
**Data:** Outubro de 2026
**Público:** Liderança Técnica e Engenharia de Software
**Escopo:** `frontend/` — Expo SDK 55, React Native 0.83, React 19.2
**Base de referência:** guias de boas práticas da Callstack (`react-native-best-practices`, `react-navigation`), TanStack Query v5, Zustand v5, OWASP MASVS, LGPD

---

## 1. Resumo Executivo

Desde a v3.0 o projeto evoluiu de forma consistente na **camada de infraestrutura de rede**. Itens que eram críticos em agosto foram resolvidos com qualidade acima da média, com decisões documentadas e testes de regressão:

- coordenação do refresh de token com geração de sessão ([`sessao.js`](../../frontend/src/config/sessao.js));
- timeout, classificação de erro de rede e retry com backoff e jitter ([`http.js`](../../frontend/src/config/http.js));
- fila offline para check-in/checkout ([`filaOffline.js`](../../frontend/src/config/filaOffline.js));
- tokens no SecureStore com migração silenciosa ([`TokenStorage.js`](../../frontend/src/services/TokenStorage.js));
- migração para `native-stack`.

O gargalo agora está **acima** da camada de rede, na forma como o app **guarda e distribui estado**:

1. **Server state gerenciado à mão.** Cada tela reimplementa `useState(dados/carregando/erro)` + `useFocusEffect` + refs anti-corrida (`geracaoRef`, `buscandoMaisRef`, `cargaEmAndamentoRef`, flags `cancelado`). Não há cache, deduplicação nem invalidação entre telas.
2. **Nenhum estado global de cliente.** Sessão e visita ativa são relidas do disco ou da API em cada tela, sem propagação. O ciclo de vida do heartbeat/geofencing depende do foco da aba **Início**, o que gera um bug real (seção 4.2).
3. **Cliente HTTP ainda duplicado** em 4 serviços, com divergência de contrato de erro — e isso bloqueia qualquer política de cache ou retry por status.

**Recomendação central:** adotar **TanStack Query v5** para server state e **Zustand v5** para o estado global de cliente (sessão), depois de unificar o cliente HTTP. A especificação de implementação está em [`sdd_tanstack_query_zustand.md`](./SDD-TanStack-Query-Zustand-v1.0.md).

---

## 2. Evolução desde a v3.0

| # | Item da v3.0 | Status atual | Evidência |
|:-:|:---|:---:|:---|
| P1 | Race condition no refresh de token | ✅ Resolvido | `renovarSessao` com promessa única + geração ([`sessao.js`](../../frontend/src/config/sessao.js#L53-L73)) |
| P1 | Duplicação do cliente HTTP | ⚠️ Pendente | `request()` em 4 serviços (seção 4.1) |
| P2 | Tokens em AsyncStorage | ✅ Resolvido | SecureStore + migração legada |
| P3 | Ausência de estado global reativo | ❌ Pendente e agravado | Seção 4.2 |
| P4 | Stack JS (`@react-navigation/stack`) | ✅ Resolvido | [`App.js`](../../frontend/App.js#L2) usa `createNativeStackNavigator` |
| P5 | `renderItem` inline / sem memo | ✅ Resolvido (Hospitais/Ranking) | ARQ-05 em [`HospitaisScreen.js`](../../frontend/src/screens/hospitais/view/HospitaisScreen.js#L321-L336) |
| P5 | `FlatList` → `FlashList` | ⚠️ Pendente | Avaliar só com medição (a recomendação é medir antes) |
| P6 | Barrel exports | ⚠️ Parcial | Uso misto: barrel em Hospitais/Ranking/Detalhe/Mapa, import direto em Perfil/Histórico |
| P7 | `TouchableOpacity` vs `Pressable` | ⚠️ Pendente | Perfil, Login, User, Privacidade, Mapa |
| P8 | Enums de domínio em componentes | ⚠️ Parcial | `avaliacaoSuficiente` foi extraído; `TIPO_LABEL`/`TIPO_FILTROS` continuam duplicados |
| P9 | `carregar` não estabilizado no Detalhe | ⚠️ Pendente | [`HospitalDetalheScreen.js`](../../frontend/src/screens/hospitais/view/HospitalDetalheScreen.js#L75-L99) (some com TanStack Query) |
| P10 | Heartbeat sem `AppState` | ⚠️ Pendente | [`HeartbeatService.js`](../../frontend/src/screens/visitas/service/HeartbeatService.js#L47-L55) |
| P11 | TypeScript desativado na prática | ⚠️ Pendente | `checkJs: false`, zero arquivos `.ts` |
| — | Timeout / retry / offline | ✅ Novo e sólido | OPS-05 / E8-04 |

---

## 3. Scorecard Técnico

| Categoria | v3.0 | v4.0 | Potencial | Criticidade |
|:---|:---:|:---:|:---:|:---:|
| Resiliência de rede (timeout, retry, offline) | 4/10 | **9/10** | 9.5/10 | Baixa |
| Segurança — persistência de credenciais | 6/10 | **9/10** | 9.5/10 | Baixa |
| Gerenciamento de server state | — | **3/10** | 9.5/10 | **Crítica** |
| Gerenciamento de estado global de cliente | — | **2/10** | 9/10 | **Crítica** |
| Arquitetura de módulos e dependências | 5/10 | 5.5/10 | 9/10 | Alta |
| Consistência de padrões | 5.5/10 | 6/10 | 9/10 | Média |
| Segurança de tipos | 2/10 | 2/10 | 9/10 | Alta |
| Testabilidade (cobertura de serviços) | 5/10 | **8/10** | 9/10 | Média |
| Observabilidade (background, produção) | — | **2/10** | 8/10 | Alta |
| Design System e acessibilidade | 9/10 | 9/10 | 10/10 | Baixa |

---

## 4. Diagnóstico Detalhado

### 4.1 Camada de dados — cliente HTTP duplicado e com contratos divergentes

**Localização**

| Arquivo | Função | Anexa `status`/`data` ao erro? | Aceita `idempotente`? |
|:---|:---|:---:|:---:|
| [`HospitalService.js`](../../frontend/src/screens/hospitais/service/HospitalService.js#L24-L95) | `request()` | ❌ **Não** | ❌ |
| [`VisitaService.js`](../../frontend/src/screens/visitas/service/VisitaService.js#L35-L109) | `request()` | ✅ | ✅ |
| [`FeedbackService.js`](../../frontend/src/screens/feedback/service/FeedbackService.js#L19-L89) | `request()` | ✅ | ✅ |
| [`PerfilService.js`](../../frontend/src/screens/perfil/service/PerfilService.js#L29-L83) | `request()` | ✅ | ❌ |
| [`LoginService.js`](../../frontend/src/screens/auth/service/LoginService.js#L213-L252) | `excluirConta()` manual | ❌ | — (sem renovação em 401) |

O mecanismo de refresh foi corrigido (`sessao.js`), mas o bloco "ler geração → 401 → `renovarSessao` → `deveEncerrarSessao` → `logout`" está copiado **5 vezes**. Isso traz três consequências:

- **Contrato de erro inconsistente.** Erros de `HospitalService` não têm `.status`. Uma política de retry ou cache que distingue 404 (não repetir) de 500 (repetir) fica impossível para o domínio mais consultado do app. **Este é o pré-requisito técnico da adoção do TanStack Query.**
- **`excluirConta()` não renova o token.** Com o access token vencido (15 min), a exclusão de conta (LGPD, F0-05) falha com "Sessão expirada" mesmo com refresh token válido.
- **Import circular** `LoginService ↔ GeofencingTaskService ↔ Hospital/VisitaService`. Hoje funciona e está documentado ([`LoginService.js#L4-L12`](../../frontend/src/screens/auth/service/LoginService.js#L4-L12)), mas é frágil. Um `apiClient` com o handler de refresh injetado no bootstrap elimina o ciclo.

**Recomendação:** criar `src/core/api/apiClient.js` reaproveitando `fetchComRetry`, `sessao.js` e a classificação de erros que já existem. Normalizar o erro em `ApiError { status, data, message }`, aceitar `signal` (cancelamento pelo TanStack Query) e `idempotente`. Detalhado na SDD, seção 7.1.

---

### 4.2 Estado — server state manual e ausência de estado global

#### 4.2.1 Server state reimplementado tela a tela

| Tela | Estados locais de dados | Mecanismos anti-corrida manuais |
|:---|:---:|:---|
| [`HospitaisScreen`](../../frontend/src/screens/hospitais/view/HospitaisScreen.js#L43-L78) | 11 `useState` | `geracaoRef`, `buscandoMaisRef`, `debounceRef`, `carregamentoInicialFeitoRef`, `visitaAtivaRef`, flag `cancelado` |
| [`RankingScreen`](../../frontend/src/screens/hospitais/view/RankingScreen.js#L38-L55) | 8 `useState` | `geracaoRef`, `buscandoMaisRef` |
| [`GeoLocalizacaoScreen`](../../frontend/src/screens/geolocalizacao/view/GeoLocalizacaoScreen.js#L53-L128) | 3 `useState` + paginação em laço | `cargaEmAndamentoRef` |
| [`HospitalDetalheScreen`](../../frontend/src/screens/hospitais/view/HospitalDetalheScreen.js#L63-L124) | 7 `useState` | — (`carregar` sem `useCallback`, deps omitidas) |
| [`HistoricoScreen`](../../frontend/src/screens/perfil/view/HistoricoScreen.js#L46-L84) | 8 `useState` | — |
| [`PerfilScreen`](../../frontend/src/screens/perfil/view/PerfilScreen.js#L37-L101) | 5 `useState` | `permissaoRef` + listener `AppState` manual |
| [`NotificacoesScreen`](../../frontend/src/screens/perfil/view/NotificacoesScreen.js#L28-L77) | 4 `useState` | `permissaoRef` + listener `AppState` manual |

O que isso causa hoje:

- **Requisições redundantes.** `VisitaService.buscarAtiva()` é chamado de forma independente por Home, Hospitais e Detalhe, a cada foco. Alternar entre abas dispara a mesma consulta várias vezes por minuto.
- **Sem cache entre telas.** O hospital em destaque na lista ([`HospitaisScreen#L198-L217`](../../frontend/src/screens/hospitais/view/HospitaisScreen.js#L198-L217)) e o mesmo hospital no Detalhe são duas requisições e dois estados. Voltar do Detalhe para a lista não aproveita nada.
- **Catálogo do mapa rebaixado a cada montagem.** No filtro "Todos", a aba Mapa pagina sequencialmente ~340 hospitais (4 requisições) toda vez que monta ou troca o raio, sem reaproveitar a carga anterior.
- **Correções de corrida espalhadas.** Os comentários de code-review (09/09, 10/09) mostram que cada tela redescobriu a mesma classe de bug: resposta antiga sobrescrevendo critério novo, ou `onEndReached` duplo. Com `queryKey` por critério, essa classe de bug deixa de ser possível.
- **Limitação conhecida aceita pelo PO** ([`alertas.js#L19-L28`](../../frontend/src/utils/alertas.js#L19-L28)): um refoco sobrescreve o estado otimista do check-in enfileirado offline. A SDD propõe uma solução (seção 7.9).

#### 4.2.2 Estado global inexistente — com bug funcional

**Sessão.** O usuário é lido do AsyncStorage em cada foco (`PerfilService.usuarioLogado()` no Perfil e no Histórico). O `LoginScreen` navega para Perfil e depende do `useFocusEffect` de lá para "descobrir" o login ([`LoginScreen.js#L24-L31`](../../frontend/src/screens/auth/view/LoginScreen.js#L24-L31)). Quando o interceptor 401 de um serviço chama `LoginService.logout()`, nenhuma tela é avisada: a UI continua mostrando o usuário até o próximo foco.

**Visita ativa e ciclo de vida de background — bug.** Quem alimenta `sincronizarVisitaAtiva()` (geofencing) e `iniciarHeartbeat()` é **apenas** o [`HomeScreen`](../../frontend/src/screens/home/view/HomeScreen.js#L43-L65), e só quando a aba Início ganha foco. Sequência real:

```
1. Usuário abre o app            → Home monta, visitaAtivaId = null, heartbeat parado
2. Vai para a aba Hospitais      → faz check-in MANUAL (HospitaisScreen.fazerCheckin)
3. Navega para o Detalhe         → cronômetro aparece
4. Não volta para a aba Início   → heartbeat NUNCA inicia; GeofencingTaskService
                                   continua com visitaAtivaId = null
5. Faz checkout manual no Detalhe → se o Home tinha uma visita anterior em memória,
                                   o heartbeat segue enviando para uma visita encerrada
```

A causa raiz é arquitetural: o estado "visita ativa" vive em 3 `useState` independentes e o efeito colateral global (heartbeat/geofencing) está preso a uma tela. A correção natural é **um único observador da visita ativa montado na raiz do app**, alimentado por uma query compartilhada (SDD, seção 7.8).

---

### 4.3 Organização de módulos e dependências

| Problema | Detalhe | Recomendação |
|:---|:---|:---|
| `src/config/` mistura configuração com infraestrutura | `http.js`, `sessao.js` e `filaOffline.js` não são configuração | Mover para `src/core/{api,session,offline}/` junto com a migração da SDD |
| Serviços em 3 lugares | `src/services/`, `src/config/`, `screens/*/service/` | Regra: `core/` = infraestrutura transversal; `screens/<feature>/service` = endpoints do domínio |
| `GeoLocalizacaoService.js` é um Context | [`GeoLocalizacaoService.js`](../../frontend/src/screens/geolocalizacao/service/GeoLocalizacaoService.js) exporta Provider + hook | Renomear para `GeolocalizacaoContext.js`. **Manter como Context** (estado de alta frequência e escopo de uma tela, ver SDD seção 4.4) |
| `App.js` com 3 responsabilidades | Navegação + handler de notificação + sincronização offline | Extrair `src/navigation/` e `src/bootstrap/` (providers, managers, syncs) |
| Constantes de domínio duplicadas | `TIPO_FILTROS` em Hospitais e Ranking; `TIPO_LABEL`/`CATEGORIA_LABEL` no Detalhe; `STATUS_LABEL` no Histórico | `src/core/constants/dominio.js` |
| Barrel `components/index.js` usado de forma mista | 5 telas via barrel, 4 via import direto | Padronizar import direto (recomendação `bundle-barrel-exports` da Callstack) |
| Estilos em 3 convenções | `css/*Style.js` (auth, perfil, user, home) vs `StyleSheet` no arquivo | Escolher uma e documentar em `CONTRIBUTING.md` |

---

### 4.4 Ciclo de vida de background

- **Heartbeat preso ao foreground e ao Home.** Além do bug da seção 4.2.2, o `setInterval` não reage a `AppState` (v3, P10).
- **Possível inconsistência de regra de negócio — validar com o backend.** O próprio [`HeartbeatService.js#L9-L15`](../../frontend/src/screens/visitas/service/HeartbeatService.js#L9-L15) diz que o heartbeat roda a cada **30 min** e que `VisitaGpsInterrompidoJob` marca `GPS_INTERROMPIDO` após **10 min** sem sinal. Se o "sinal" considerado pelo job for o heartbeat, toda visita sem outra fonte de posição seria interrompida antes do primeiro heartbeat. Confirmar a fonte de `ultimaPosicaoEm` no backend.
- **Falhas silenciosas em background.** `GeofencingTaskService` só faz `console.warn`, que não existe em release. Check-ins perdidos por 409 ou erro inesperado ficam invisíveis.

---

### 4.5 Qualidade, DX e operação

| Item | Situação | Recomendação |
|:---|:---|:---|
| TypeScript | `checkJs: false`, nenhum `.ts` | Começar por `core/` e pelos contratos de API (DTOs). A SDD já nasce com `queryKeys` tipáveis |
| Dois lockfiles | `package-lock.json` **e** `yarn.lock` na raiz | Escolher um gerenciador e remover o outro (instalações não determinísticas em CI/EAS) |
| Binário na raiz | `saude-monitor-preview.apk` (47 MB) | Conferir `.gitignore`/`.easignore`; distribuir via EAS/artefato de CI |
| Lint | `--max-warnings 16` tolera dívida | Zerar e baixar para 0; adicionar `@tanstack/eslint-plugin-query` |
| Observabilidade | Sem crash reporting nem telemetria | Sentry (ou equivalente) com breadcrumbs nas tasks de geofencing e na fila offline |
| Testes | ~42 suítes, ótima cobertura de serviços | Criar `renderComProviders` antes da migração (SDD seção 9) |
| Textos | Mensagens sem acento ("Permissao de localizacao negada", "Atencao") | Revisão de cópia / centralizar strings |

---

## 5. Decisão de Estado: Zustand vs Context API (resumo)

A avaliação completa, com matriz ponderada, está na SDD, seção 4. O critério decisivo **não é performance de re-render** (a recomendação `js-atomic-state` da Callstack pede medição antes de justificar por esse motivo). O critério decisivo é este:

> **Quem escreve o estado de sessão hoje está fora do React:** o interceptor 401 dos serviços, o `LoginService` e a task de geofencing (que pode rodar sem a árvore React montada). A Context API não permite ler nem escrever fora de componentes sem uma ponte de eventos feita à mão. O Zustand expõe `getState()`, `setState()` e `subscribe()` em um store vanilla, sem Provider.

**Resultado:** Zustand (87/90) × Context (41/90). A Context API continua sendo usada onde faz sentido, como o GPS em tempo real com escopo de uma única tela.

---

## 6. Roadmap Priorizado

| Fase | Entrega | Esforço | Depende de |
|:-:|:---|:-:|:-:|
| **0** | `apiClient` unificado + `ApiError` + injeção do refresh (quebra o ciclo) | 2–3 d | — |
| **1** | Infra TanStack Query + Zustand (`queryClient`, managers RN, `queryKeys`, `sessaoStore`, test utils) | 2 d | 0 |
| **2** | Migração de leitura: Hospitais, Ranking, Detalhe, Mapa, Histórico | 4–5 d | 1 |
| **3** | Visita ativa global + `VisitaAtivaSync` na raiz (corrige o bug 4.2.2) + mutations | 3 d | 1 |
| **4** | Sessão reativa em Login/Perfil/Histórico + permissões via query | 2 d | 1 |
| **5** | Fila offline observável (resolve a limitação de `alertas.js`) + persistência de cache pública (opcional) | 2–3 d | 3 |
| **6** | Reorganização `core/` + constantes de domínio + import direto + `Pressable` | contínuo | — |
| **7** | TypeScript incremental (core → serviços → hooks) | contínuo | 0 |
| **8** | Observabilidade (Sentry) + validação da regra heartbeat/GPS com backend | 1–2 d | — |

---

## 7. O que está bem e deve ser preservado

- **Engenharia de resiliência de rede.** Timeout, backoff com jitter, `Retry-After`, `idempotente` explícito e classificação "sem internet × servidor indisponível" estão no nível de produção. **O TanStack Query deve se apoiar nisso, não substituir** (SDD, seção 7.2).
- **Fila offline com `ocorridoEm`.** Preserva o horário real do evento: decisão de domínio correta e bem documentada.
- **Comentários rastreáveis** (épicos, RNs, achados de code-review com data). Eles reduzem muito o custo de onboarding.
- **Proteções do mapa** (BUG-04, desmontar antes de navegar) e testes de regressão da ordem de execução.
- **Setup de testes rigoroso** ([`jest.setup.js`](../../frontend/jest.setup.js)): `fetch` que falha alto quando não é mockado.
- **Design System e acessibilidade** consistentes.
